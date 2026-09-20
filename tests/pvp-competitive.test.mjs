import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  if (!name.startsWith("@/")) return require(name);
  const source = readFileSync(name.slice(2) + ".ts", "utf8");
  const loaded = { exports: {} };
  new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}
const fighters = (prefix, attack = 20) => ["potato", "carrot", "corn"].map((crop, slot) => ({ id: `${prefix}${slot}`, crop, mutation: "normal", personality: "clever", hp: 100, attack: attack + slot, defense: 20, speed: 25 + slot }));
const id = "11111111-1111-4111-8111-111111111111";

test("server replay matches the seeded client battle and cannot reward dungeon currency", () => {
  const match = { challengerId: "11111", opponentId: "22222", challengerTeam: fighters("a", 80), opponentTeam: fighters("b", 10), battleId: id, battleSeed: 27 };
  const server = load("@/lib/pvp-resolution").resolvePvpMatch(match);
  const battle = load("@/lib/battle");
  const client = battle.advanceBattle(battle.createFriendlyBattle(match.challengerTeam, match.opponentTeam, id, 27), 60000);
  assert.equal(server.result, client.status === "victory" ? "challenger" : client.status === "defeat" ? "opponent" : "draw");
  assert.equal(server.winnerId, server.result === "challenger" ? "11111" : server.result === "opponent" ? "22222" : null);
  assert.equal(battle.isRewardableDungeonVictory(client), false);
  assert.deepEqual(server, load("@/lib/pvp-resolution").resolvePvpMatch(match));
});

test("completion is atomic/idempotent; history and rankings use server rows", async () => {
  const db = new PGlite({ extensions: { pg_trgm } });
  const rpc = async (name, args, types) => (await db.query(`select public.${name}(${types.map((t,i) => `$${i+1}::${t}`).join(",")}) as result`, args)).rows[0].result;
  try {
    await db.exec("create schema extensions; create schema realtime; create role anon; create role authenticated; create role service_role bypassrls; create table realtime.messages(extension text, topic text); create function realtime.topic() returns text language sql stable as $$ select current_setting('sprout.test_topic', true) $$;");
    for (const file of ["20260920_cloud_saves.sql", "20260921_social.sql", "20260922_farm_presence.sql", "20260925_live_pvp.sql", "20260926_competitive_pvp.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260926_competitive_pvp.sql", "utf8"));
    await db.exec("insert into public.players(discord_user_id,username,coins,combat_power) values('11111','alice',100,20),('22222','bob',200,10),('33333','cara',100,50),('44444','outsider',999,999); insert into public.friend_links(user_low,user_high,requested_by,status) values('11111','22222','11111','accepted'),('11111','33333','11111','pending');");
    const teamA = fighters("a", 80), teamB = fighters("b", 10);
    await db.query("insert into public.live_pvp_matches(id,challenger_id,opponent_id,farm_owner_id,status,challenger_team,opponent_team,battle_id,battle_seed) values($1::uuid,'11111','22222','11111','ready',$2::jsonb,$3::jsonb,$1::uuid,27)", [id, JSON.stringify(teamA), JSON.stringify(teamB)]);
    const before = (await db.query("select * from public.game_saves")).rows;
    const finalize = (actor, result, winner) => rpc("finalize_sprout_pvp", [id, actor, result, winner], ["uuid","text","text","text"]);
    assert.equal((await finalize("33333", "challenger", "11111")).error, "forbidden");
    assert.equal((await finalize("11111", "draw", "11111")).error, "invalid");
    const concurrent = await Promise.all([finalize("11111", "challenger", "11111"), finalize("22222", "challenger", "11111")]);
    assert.deepEqual(concurrent.map((x) => x.result), ["challenger", "challenger"]);
    assert.equal((await finalize("11111", null, null)).pvpWins, 1);
    assert.equal((await db.query("select pvp_wins from public.players where discord_user_id='11111'")).rows[0].pvp_wins, 1);
    assert.equal((await db.query("select pvp_wins from public.players where discord_user_id='22222'")).rows[0].pvp_wins, 0);
    const history = await rpc("get_sprout_pvp_history", ["11111"], ["text"]);
    assert.equal(history[0].opponent.username, "bob");
    assert.equal(history[0].result, "win");
    assert.equal((await rpc("get_sprout_pvp_history", ["22222"], ["text"]))[0].result, "loss");
    const board = (category, scope) => rpc("get_sprout_leaderboard", ["11111", category, scope], ["text","text","text"]);
    assert.equal((await board("money", "global")).entries[0].player.username, "outsider");
    assert.deepEqual((await board("money", "global")).entries.slice(2, 4).map((x) => x.player.username), ["alice", "cara"], "equal values break ties by Discord ID");
    assert.equal((await board("combat-power", "global")).entries[0].player.username, "outsider");
    assert.equal((await board("pvp-wins", "global")).entries[0].player.username, "alice");
    assert.deepEqual((await board("money", "friends")).entries.map((x) => x.player.username), ["bob", "alice"]);
    assert.deepEqual((await board("pvp-wins", "friends")).entries.map((x) => x.player.username), ["alice", "bob"]);
    assert.equal((await db.query("select coins from public.players where discord_user_id='11111'")).rows[0].coins, 100);
    assert.deepEqual((await db.query("select * from public.game_saves")).rows, before);
    const drawId = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into public.live_pvp_matches(id,challenger_id,opponent_id,farm_owner_id,status,challenger_team,opponent_team,battle_id,battle_seed) values($1::uuid,'11111','22222','11111','ready',$2::jsonb,$3::jsonb,$1::uuid,28)", [drawId, JSON.stringify(teamA), JSON.stringify(teamB)]);
    assert.equal((await rpc("finalize_sprout_pvp", [drawId, "11111", "draw", null], ["uuid","text","text","text"])).result, "draw");
    assert.equal((await db.query("select pvp_wins from public.players where discord_user_id='11111'")).rows[0].pvp_wins, 1);
    const extra = Array.from({ length: 55 }, (_, i) => `('${String(50000 + i)}','rank${i}',${300 + i})`).join(",");
    await db.exec(`insert into public.players(discord_user_id,username,coins) values ${extra}`);
    const globalMoney = await board("money", "global");
    assert.equal(globalMoney.entries.length, 50);
    assert.ok(globalMoney.currentPlayer.rank > 50);
    assert.equal(globalMoney.currentPlayer.value, 100);
  } finally { await db.close(); }
});

test("completion route derives actor and ignores forged winner fields", async () => {
  const calls = [];
  const originalLoad = load;
  const source = readFileSync("app/api/pvp/matches/[id]/complete/route.ts", "utf8");
  const exports = {};
  const loaded = { exports };
  const localRequire = (name) => name === "@/lib/pvp-server" ? { completePvpMatch: async (actor, match) => { calls.push([actor, match]); return { result: "draw", winnerId: null, pvpWins: 0 }; } }
    : name === "@/lib/social-server" ? { socialRoute: async (request, handler) => {
      if (request.headers.get("authorization") !== "Bearer trusted") return Response.json({}, { status: 401 });
      return Response.json(await handler("11111"));
    } } : originalLoad(name);
  new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(localRequire, loaded, exports);
  const route = loaded.exports;
  const context = { params: Promise.resolve({ id }) };
  const request = (trusted) => new Request(`https://sprout.test/api/pvp/matches/${id}/complete`, { method: "POST", headers: { authorization: trusted ? "Bearer trusted" : "", "content-type": "application/json" }, body: JSON.stringify({ winnerId: "44444", result: "challenger", pvpWins: 999 }) });
  assert.equal((await route.POST(request(false), context)).status, 401);
  assert.equal((await route.POST(request(true), context)).status, 200);
  assert.deepEqual(calls, [["11111", id]]);
});
