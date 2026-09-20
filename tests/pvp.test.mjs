import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const require = createRequire(import.meta.url);
function loader(mocks = {}) {
const cache = new Map();
function load(name) {
  if (name in mocks) return mocks[name];
  if (name === "server-only") return {};
  if (!name.startsWith("@/")) return require(name);
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(name.slice(2) + ".ts", "utf8");
  const loaded = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", output)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}
return load;
}
const load = loader();
const { createFriendlyBattle, advanceBattle, isRewardableDungeonVictory } = load("@/lib/battle");
const { validPvpTeamSelection, shouldCancelSetupOnLeave, friendlyResultForLocal } = load("@/lib/pvp");
const fighters = (prefix) => ["potato", "carrot", "corn"].map((crop, slot) => ({ id: `${prefix}${slot}`, crop, mutation: "normal", personality: "clever", hp: 100 + slot, attack: 20 + slot, defense: 20, speed: 25 + slot }));
const matchId = "11111111-1111-4111-8111-111111111111";

test("friendly battle replays identically and never carries Dungeon mode", () => {
  const first = createFriendlyBattle(fighters("a"), fighters("b"), matchId, 1234);
  const second = createFriendlyBattle(fighters("a"), fighters("b"), matchId, 1234);
  assert.equal(first.mode, "friendly-pvp");
  assert.equal(isRewardableDungeonVictory({ ...first, status: "victory" }), false);
  assert.equal(isRewardableDungeonVictory({ ...load("@/lib/battle").createBattle(fighters("a"), "dungeon", 1234), status: "victory" }), true);
  assert.equal(load("@/lib/battle").createBattle(fighters("a"), "dungeon", 1234).mode, "dungeon");
  assert.deepEqual(advanceBattle(first, 60000), advanceBattle(second, 60000));
  assert.equal(friendlyResultForLocal("victory", false), "Defeat");
  assert.equal(friendlyResultForLocal("victory", true), "Victory");
});

test("team selection and setup disconnect stay separate from an active friendly battle", () => {
  assert.equal(validPvpTeamSelection(["a0", "a1", "a2"], fighters("a")), true);
  assert.equal(validPvpTeamSelection(["a0", "a0", "a2"], fighters("a")), false);
  assert.equal(validPvpTeamSelection(["a0", "a1", "missing"], fighters("a")), false);
  assert.equal(shouldCancelSetupOnLeave(true, false, "waiting_for_teams"), true);
  assert.equal(shouldCancelSetupOnLeave(true, false, "ready"), false);
  assert.equal(shouldCancelSetupOnLeave(false, false, "waiting_for_teams"), false);
});

test("server match pairing, cloud roster validation, one seed, and participant-only snapshots", async () => {
  const db = new PGlite({ extensions: { pg_trgm } });
  const rpc = async (name, args, types) => (await db.query(`select public.${name}(${types.map((type, index) => `$${index + 1}::${type}`).join(",")}) as result`, args)).rows[0].result;
  try {
    await db.exec("create schema extensions; create schema realtime; create role anon; create role authenticated; create role service_role bypassrls; create table realtime.messages(extension text, topic text); create function realtime.topic() returns text language sql stable as $$ select current_setting('sprout.test_topic', true) $$;");
    for (const file of ["20260920_cloud_saves.sql", "20260921_social.sql", "20260922_farm_presence.sql", "20260925_live_pvp.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260925_live_pvp.sql", "utf8"));
    await db.exec("insert into public.players(discord_user_id,username) values('11111','alice'),('22222','bob'),('33333','visitor'),('44444','stranger'); insert into public.friend_links(user_low,user_high,requested_by,status) values('11111','22222','11111','accepted'),('11111','33333','11111','accepted');");
    for (const [id, prefix] of [["11111", "a"], ["22222", "b"]]) await db.query("insert into public.game_saves(discord_user_id,save_version,save_data) values($1,2,$2::jsonb)", [id, JSON.stringify({ version: 2, game: { fighters: fighters(prefix) } })]);
    const savesBefore = (await db.query("select discord_user_id,save_data,revision from public.game_saves order by discord_user_id")).rows;
    const create = (actor, other, id = matchId) => rpc("create_sprout_pvp", [id, actor, other, "11111"], ["uuid", "text", "text", "text"]);
    const accept = (actor) => rpc("accept_sprout_pvp", [matchId, actor], ["uuid", "text"]);
    const submit = (actor, ids, revision = 1) => rpc("submit_sprout_pvp_team", [matchId, actor, ids, revision], ["uuid", "text", "text[]", "bigint"]);
    const get = (actor) => rpc("get_sprout_pvp", [matchId, actor], ["uuid", "text"]);
    assert.equal((await create("11111", "44444")).error, "forbidden");
    assert.equal((await create("22222", "33333", "22222222-2222-4222-8222-222222222222")).ok, true, "two visitors may challenge in their shared friend's farm");
    assert.equal((await create("11111", "22222")).ok, true);
    assert.equal((await accept("33333")).error, "conflict");
    assert.equal((await submit("11111", ["a0", "a1", "a2"])).error, "conflict", "cannot submit before acceptance");
    assert.equal((await accept("22222")).ok, true);
    assert.equal((await submit("11111", ["a0", "a1", "a2"], 99)).error, "conflict", "stale cloud revision is rejected");
    assert.equal((await submit("11111", ["a0", "a0", "a2"])).error, "invalid");
    assert.equal((await submit("11111", ["a0", "a1"])).error, "invalid");
    assert.equal((await submit("11111", ["a0", "a1", "missing"])).error, "invalid");
    assert.equal((await submit("11111", ["a0", "a1", "a2"])).ok, true);
    assert.equal((await get("11111")).status, "waiting_for_teams");
    assert.equal((await get("11111")).battleSeed, null);
    assert.equal((await submit("22222", ["b0", "b1", "b2"])).ok, true);
    const own = await get("11111");
    const other = await get("22222");
    assert.equal(own.status, "ready");
    assert.deepEqual(own, other);
    assert.equal(own.challengerTeam[0].attack, 20);
    assert.equal(own.opponentTeam[0].id, "b0");
    assert.ok(Number.isInteger(own.battleSeed));
    assert.match(own.battleId, /^[a-f0-9-]{36}$/);
    assert.equal((await submit("11111", ["a0", "a1", "a2"])).error, "conflict");
    assert.equal((await get("11111")).battleSeed, own.battleSeed);
    assert.equal((await get("11111")).battleId, own.battleId);
    assert.deepEqual((await db.query("select discord_user_id,save_data,revision from public.game_saves order by discord_user_id")).rows, savesBefore, "PvP never mutates Save V2");
    assert.equal(await get("33333"), null);
    assert.equal((await db.query("select has_table_privilege('authenticated','public.live_pvp_matches','select') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.submit_sprout_pvp_team(uuid,text,text[],bigint)','execute') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('service_role','public.can_join_sprout_farm(text,text)','execute') as allowed")).rows[0].allowed, true);
    const abandoned = "33333333-3333-4333-8333-333333333333";
    assert.equal((await create("11111", "22222", abandoned)).ok, true);
    assert.equal((await rpc("cancel_sprout_pvp", [abandoned, "33333"], ["uuid", "text"])).ok, false);
    assert.equal((await rpc("cancel_sprout_pvp", [abandoned, "22222"], ["uuid", "text"])).ok, true);
    assert.equal((await rpc("get_sprout_pvp", [abandoned, "11111"], ["uuid", "text"])).status, "cancelled");
    const expiring = "44444444-4444-4444-8444-444444444444";
    assert.equal((await create("11111", "22222", expiring)).ok, true);
    await db.query("update public.live_pvp_matches set expires_at=now()-interval '1 second' where id=$1::uuid", [expiring]);
    assert.equal((await rpc("get_sprout_pvp", [expiring, "11111"], ["uuid", "text"])).status, "expired");
    await db.query("update public.live_pvp_matches set expires_at=now()-interval '1 second' where id=$1::uuid", [matchId]);
    assert.equal((await get("11111")).status, "expired", "abandoned ready snapshots eventually expire");
  } finally { await db.close(); }
});

test("PvP API derives actor from session and accepts fighter IDs, never client stats or result", async () => {
  const calls = [];
  const server = loader({
    "@/lib/discord-session": { sessionUserFromRequest: (request) => request.headers.get("authorization") === "Bearer trusted" ? "11111" : null },
    "@/lib/save-storage": { validateSproutSave: () => true },
    "@/lib/supabase-admin": {
      readCloudSave: async () => ({ save: { game: { fighters: fighters("a") } }, revision: 7 }),
      supabaseRequest: async (path, options) => { calls.push({ path, body: JSON.parse(options.body) }); return Response.json({ ok: true }); },
    },
  });
  const createRoute = server("@/app/api/pvp/matches/route");
  const matchRoute = server("@/app/api/pvp/matches/[id]/route");
  const request = (method, path, body, trusted = true) => new Request(`https://sprout.test${path}`, { method, headers: trusted ? { authorization: "Bearer trusted" } : {}, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await createRoute.POST(request("POST", "/api/pvp/matches", { challengeId: matchId, opponentId: "22222", farmOwnerId: "11111" }, false))).status, 401);
  assert.equal((await createRoute.POST(request("POST", "/api/pvp/matches", { challengeId: matchId, opponentId: "22222", farmOwnerId: "11111", actor: "33333" }))).status, 200);
  assert.deepEqual(calls.at(-1).body, { p_id: matchId, p_actor: "11111", p_other: "22222", p_owner: "11111" });
  const context = { params: Promise.resolve({ id: matchId }) };
  assert.equal((await matchRoute.PUT(request("PUT", `/api/pvp/matches/${matchId}`, { fighterIds: ["a0", "a0", "a2"] }), context)).status, 400);
  assert.equal((await matchRoute.PUT(request("PUT", `/api/pvp/matches/${matchId}`, { fighterIds: ["a0", "a1", "missing"] }), context)).status, 400);
  assert.equal((await matchRoute.PUT(request("PUT", `/api/pvp/matches/${matchId}`, { fighterIds: ["a0", "a1", "a2"], fighters: [{ hp: 999999 }], winner: "11111", seed: 7 }), context)).status, 200);
  assert.deepEqual(calls.at(-1).body, { p_id: matchId, p_actor: "11111", p_ids: ["a0", "a1", "a2"], p_expected_revision: 7 });
});
