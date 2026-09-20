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
    const base = name.replace("@/", "");
    let source;
    try { source = readFileSync(base + ".ts", "utf8"); } catch { source = readFileSync(base + ".tsx", "utf8"); }
    const loaded = { exports: {} };
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
    new Function("require", "module", "exports", "process", outputText)(load, loaded, loaded.exports, { env: { NODE_ENV: "production" } });
    cache.set(name, loaded.exports);
    return loaded.exports;
  }
  return load;
}
const load = loader();
const social = load("@/lib/social");
const { FIRST_WORLD, FARM_OWNER_TILE } = load("@/lib/world-data");
const { findPath, findPathToAdjacent } = load("@/lib/pathfinding");
const fighter = (id, extra = {}) => ({ id, crop: "potato", mutation: "normal", personality: "protective", hp: 130, attack: 20, defense: 35, speed: 20, ...extra });
const roster = [fighter("one"), fighter("two"), fighter("three"), fighter("four")];
const save = () => ({ version: 2, savedAt: 1234, game: { coins: 100, farmXp: 100, seeds: { potato: 3, carrot: 0, corn: 0 }, selectedCrop: "potato", plots: Array.from({ length: 144 }, (_, id) => ({ id, crop: id === 0 ? "potato" : null, plantedAt: id === 0 ? 0 : null })), harvestedCrops: [], collection: [], fighters: structuredClone(roster) }, world: { farmerTile: FIRST_WORLD.start, facing: "right" } });
const profile = { userId: "22222", username: "bob", displayName: "Bob", avatar: null, farmLevel: 3, coins: 100, combatPower: 0, pvpWins: 0 };

test("defense snapshot checks IDs and derives CP using actual Fighter fields", () => {
  assert.deepEqual(social.canonicalFriendPair("22222", "11111"), ["11111", "22222"]);
  assert.throws(() => social.canonicalFriendPair("11111", "11111"));
  assert.throws(() => social.buildDefenseSnapshot(roster, ["missing"]));
  assert.throws(() => social.buildDefenseSnapshot(roster, ["one", "one"]));
  assert.throws(() => social.buildDefenseSnapshot(roster, ["one", "two", "three", "four"]));
  assert.equal(social.calculateCombatPower(social.buildDefenseSnapshot(roster, ["one", "three"])), 502);
  assert.deepEqual(social.buildDefenseSnapshot(roster, []), []);
});

test("farm/profile snapshots whitelist fields, preserve timers, and do not alias own data", () => {
  const source = save();
  const original = JSON.stringify(source);
  const snapshot = social.sanitizeFarmSnapshot({ ...profile, token: "secret" }, source);
  assert.deepEqual(Object.keys(snapshot).sort(), ["farmXp", "owner", "plots", "unlockedPlotCount"]);
  assert.equal(snapshot.plots.length, 27);
  assert.deepEqual(snapshot.plots[0], { id: 0, crop: "potato", plantedAt: 0 });
  assert.equal("token" in snapshot.owner, false);
  snapshot.plots[0].crop = null;
  assert.equal(JSON.stringify(source), original);
  assert.equal(social.canModifyFarm({ mode: "visiting", ownerId: "22222", snapshot }), false);
  const safe = social.publicProfile({ discord_user_id: "22222", username: "bob", farm_level: 3, coins: 100, combat_power: 0, pvp_wins: 0, save_data: source, session: "hidden" });
  assert.equal("save_data" in safe, false);
  assert.equal("session" in safe, false);
});

test("Friends exit and idle owner are reachable using the existing collision grid", () => {
  const { worldToCell } = load("@/lib/world-coordinates");
  const exit = worldToCell(FIRST_WORLD, FIRST_WORLD.buildings.find((b) => b.id === "world-exit").entrance);
  assert.ok(findPath(FIRST_WORLD.blocked, 45, 34, FIRST_WORLD.start, exit).length);
  assert.equal(FIRST_WORLD.blocked[FARM_OWNER_TILE.y * 45 + FARM_OWNER_TILE.x], false);
  assert.ok(findPathToAdjacent(FIRST_WORLD.blocked, 45, 34, FIRST_WORLD.start, FARM_OWNER_TILE));
});

test("social API routes require sessions and ignore spoofed actor IDs and defense stats", async () => {
  const calls = [];
  let farmAllowed = false;
  const serverLoad = loader({
    "@/lib/discord-session": { sessionUserFromRequest: (req) => req.headers.get("authorization") === "Bearer trusted" ? "11111" : null },
    "@/lib/supabase-admin": {
      readCloudSave: async () => ({ save: save(), revision: 7 }),
      supabaseRequest: async (path, init) => {
        const body = init?.body ? JSON.parse(init.body) : undefined;
        calls.push({ path, body });
        if (path.startsWith("friend_links?")) return Response.json([]);
        if (path === "rpc/get_sprout_defense") return Response.json({ revision: 7, fighters: [] });
        if (path === "rpc/get_sprout_friend_farm") return Response.json(farmAllowed ? { profile: { discord_user_id: "22222", username: "bob", farm_level: 3, coins: 100, combat_power: 0, pvp_wins: 0, private_backend_field: "hidden" }, save: save() } : null);
        if (path === "rpc/search_sprout_players") return Response.json([{ discord_user_id: "11111", username: "actor" }, { discord_user_id: "22222", username: "bob", farm_level: 1, coins: 100, combat_power: 0, pvp_wins: 0, private_backend_field: "hidden" }]);
        return Response.json({ ok: true });
      },
    },
  });
  const request = (path, method = "GET", body, auth = true) => new Request(`https://sprout.test${path}`, { method, headers: auth ? { authorization: "Bearer trusted" } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  const friendsRoute = serverLoad("@/app/api/friends/route");
  assert.equal((await friendsRoute.GET(request("/api/friends", "GET", undefined, false))).status, 401);
  assert.equal(calls.length, 0);
  const requests = serverLoad("@/app/api/friends/requests/route");
  assert.equal((await requests.POST(request("/api/friends/requests", "POST", { friendId: "22222", actor: "33333" }))).status, 200);
  assert.equal(calls.find((c) => c.path === "rpc/change_sprout_friendship").body.p_actor, "11111");
  const defenseRoute = serverLoad("@/app/api/defense-team/route");
  const response = await defenseRoute.PUT(request("/api/defense-team", "PUT", { fighterIds: ["one"], ownerId: "22222", combatPower: 999999, hp: 999999 }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find((c) => c.path === "rpc/set_sprout_defense").body, { p_owner: "11111", p_ids: ["one"], p_expected_revision: 7 });
  const farmRoute = serverLoad("@/app/api/friends/[friendId]/farm/route");
  const context = { params: Promise.resolve({ friendId: "22222" }) };
  assert.equal((await farmRoute.GET(request("/api/friends/22222/farm"), context)).status, 403);
  farmAllowed = true;
  const visible = await (await farmRoute.GET(request("/api/friends/22222/farm"), context)).json();
  assert.deepEqual(Object.keys(visible).sort(), ["farmXp", "owner", "plots", "unlockedPlotCount"]);
  assert.equal("private_backend_field" in visible.owner, false);
  assert.equal(JSON.stringify(visible).includes("fighters"), false);
  const searchRoute = serverLoad("@/app/api/players/search/route");
  const search = await (await searchRoute.GET(request("/api/players/search?q=bo"))).json();
  assert.deepEqual(search.players.map((p) => p.userId), ["22222"]);
});

function walkElements(element, predicate) {
  if (!element || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap((child) => walkElements(child, predicate));
  return [...(predicate(element) ? [element] : []), ...walkElements(element.props?.children, predicate)];
}

test("visiting uses snapshot plots, blocks every farm mutation, and never persists visitor movement", () => {
  let movementOptions;
  let mutations = 0;
  let returned = false;
  let arrival;
  let deferArrival = false;
  const stateUpdates = [];
  const uiMocks = {
    react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, (value) => stateUpdates.push(value)], useRef: (value) => ({ current: value }), useEffect: () => {}, useMemo: (value) => value(), useCallback: (value) => value },
    "@/hooks/useDiscord": { useDiscord: () => ({ user: { id: "11111", username: "Alice" } }) },
    "@/hooks/useWorldMovement": { useWorldMovement: (_world, options) => {
      movementOptions = options;
      return { state: { tile: FIRST_WORLD.start, position: FIRST_WORLD.start, facing: "right", moving: false, frame: 0 }, moveTo: (_tile, onArrival) => { if (deferArrival) arrival = onArrival; else onArrival?.(); }, cancelInteraction: () => {} };
    } },
  };
  for (const component of ["WorldMap", "WorldSeedShopPanel", "WorldDungeonOverlay", "WorldFarmhouseOverlay", "WorldMarketOverlay", "WorldFriendsOverlay", "WorldNotifications", "RemotePlayersLayer"]) uiMocks[`@/components/${component}`] = { default: component };
  const uiLoad = loader(uiMocks);
  const PixelWorld = uiLoad("@/components/PixelWorld").default;
  const own = save();
  const before = JSON.stringify(own);
  const props = { coins: 100, unlockedPlotCount: 27, plots: own.game.plots, now: 99999999, selectedCrop: "potato", setSelectedCrop: () => { mutations++; }, seeds: own.game.seeds, buySeed: () => { mutations++; }, handlePlotClick: () => { mutations++; return null; }, fighters: roster, collection: [], harvestedCrops: [], sellCrops: () => { mutations++; }, awakenCrop: () => { mutations++; }, fuseFighters: () => { mutations++; }, awardBattleVictory: () => { mutations++; }, notifications: [], notify: () => {}, onDismissNotification: () => {}, initialFarmerTile: FIRST_WORLD.start, initialFarmerFacing: "left", onFarmerSettled: () => { mutations++; } };
  const wrapped = PixelWorld(props);
  const snapshot = social.sanitizeFarmSnapshot(profile, save());
  const friendBefore = JSON.stringify(snapshot);
  const visited = wrapped.type({ ...wrapped.props, context: { mode: "visiting", ownerId: "22222", snapshot }, onReturnHome: () => { returned = true; } });
  assert.equal(movementOptions.onSettled, undefined);
  const map = walkElements(visited, (e) => e.type === "WorldMap")[0];
  assert.equal(map.props.plots, snapshot.plots);
  assert.equal(map.props.readOnly, true);
  map.props.onPlotClick(0); // Ready crop must not harvest.
  map.props.onPlotClick(1); // Empty crop must not open planting.
  for (const id of ["seed-shop", "market", "farmhouse", "dungeon"]) map.props.onBuildingClick(id);
  map.props.moveTo(FIRST_WORLD.start);
  assert.equal(mutations, 0);
  assert.equal(JSON.stringify(own), before);
  assert.equal(JSON.stringify(snapshot), friendBefore);
  const returnButton = walkElements(visited, (e) => e.type === "button" && e.props.children === "Return Home")[0];
  returnButton.props.onClick();
  assert.equal(returned, true);
  const homeScene = wrapped.type(wrapped.props);
  assert.equal(movementOptions.onSettled, props.onFarmerSettled);
  assert.equal(movementOptions.initialFacing, "left");
  const homeMap = walkElements(homeScene, (e) => e.type === "WorldMap")[0];
  assert.equal(homeMap.props.plots, own.game.plots);
  homeMap.props.onPlotClick(0);
  assert.equal(mutations, 1);
  assert.equal(map.props.players.length, 1);
  const remoteLayer = walkElements(visited, (e) => e.type === "RemotePlayersLayer")[0];
  assert.equal(remoteLayer.props.ownerId, "22222");
  assert.equal(remoteLayer.props.ownerName, "Bob");
  assert.equal(homeMap.props.players.length, 1);
  deferArrival = true;
  stateUpdates.length = 0;
  homeMap.props.onBuildingClick("world-exit");
  assert.equal(typeof arrival, "function");
  assert.equal(stateUpdates.includes(true), false, "exit must wait for arrival");
  arrival();
  assert.ok(stateUpdates.includes(true), "intentional exit arrival opens Neighborhood");
});

test("social SQL migration enforces relationships, defense transactions, and browser denial", async (t) => {
  const db = new PGlite({ extensions: { pg_trgm } });
  try {
    await db.exec("create schema extensions; create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync("supabase/migrations/20260920_cloud_saves.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260921_social.sql", "utf8"));
    await db.exec("grant select, insert, update, delete on public.players, public.game_saves to service_role;");
    await db.query("insert into players(discord_user_id, username, display_name) values ('11111','Alice_Potato','Alice 100%'),('22222','Bob','Bob Farmer'),('33333','Charlie','Charley')");
    await db.exec("set role service_role;");
    const rpc = async (name, args) => (await db.query(`select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args)).rows[0].result;

    await t.test("canonical pair, self-request, and duplicate/reversed requests", async () => {
      assert.equal((await rpc("change_sprout_friendship", ["11111", "11111", "request"])).error, "invalid");
      assert.deepEqual(await rpc("change_sprout_friendship", ["22222", "11111", "request"]), { ok: true });
      const link = (await db.query("select * from friend_links")).rows[0];
      assert.equal(link.user_low, "11111"); assert.equal(link.user_high, "22222");
      assert.equal((await rpc("change_sprout_friendship", ["22222", "11111", "request"])).error, "conflict");
      assert.equal((await rpc("change_sprout_friendship", ["11111", "22222", "request"])).error, "conflict");
      assert.equal((await db.query("select count(*)::int as n from friend_links")).rows[0].n, 1);
    });

    await t.test("only recipient accepts or declines; only sender cancels; either friend removes", async () => {
      assert.equal((await rpc("change_sprout_friendship", ["22222", "11111", "accept"])).error, "conflict");
      assert.equal((await rpc("change_sprout_friendship", ["22222", "11111", "decline"])).error, "conflict");
      assert.equal((await rpc("change_sprout_friendship", ["11111", "22222", "cancel"])).error, "conflict");
      assert.deepEqual(await rpc("change_sprout_friendship", ["11111", "22222", "accept"]), { ok: true });
      assert.equal((await rpc("change_sprout_friendship", ["33333", "22222", "remove"])).error, "conflict");
      assert.deepEqual(await rpc("change_sprout_friendship", ["22222", "11111", "remove"]), { ok: true });
      await rpc("change_sprout_friendship", ["11111", "22222", "request"]);
      assert.deepEqual(await rpc("change_sprout_friendship", ["22222", "11111", "decline"]), { ok: true });
      await rpc("change_sprout_friendship", ["11111", "22222", "request"]);
      assert.deepEqual(await rpc("change_sprout_friendship", ["11111", "22222", "cancel"]), { ok: true });
    });

    await t.test("case-insensitive partial search excludes self and treats SQL/wildcard characters literally", async () => {
      assert.equal((await db.query("select * from search_sprout_players($1,$2)", ["11111", "ali"])).rows.length, 0);
      assert.equal((await db.query("select * from search_sprout_players($1,$2)", ["22222", "aLi"])).rows[0].discord_user_id, "11111");
      assert.equal((await db.query("select * from search_sprout_players($1,$2)", ["22222", "100%"])).rows.length, 1);
      assert.equal((await db.query("select * from search_sprout_players($1,$2)", ["22222", "%_"])).rows.length, 0);
      assert.equal((await db.query("select * from search_sprout_players($1,$2)", ["22222", "' OR 1=1 --"])).rows.length, 0);
      await db.exec("insert into players(discord_user_id,username) select (50000+n)::text, 'TestPlayer'||n from generate_series(1,25) n");
      assert.equal((await db.query("select * from search_sprout_players($1,$2)", ["11111", "testplayer"])).rows.length, 20);
    });

    await t.test("defense uses saved stats, rejects invalid IDs and stale revisions, computes CP", async () => {
      await rpc("write_sprout_save", ["11111", save(), null, 3, 100]);
      for (const ids of [["missing"], ["one", "one"], ["one", "two", "three", "four"]]) {
        assert.equal((await rpc("set_sprout_defense", ["11111", ids, 1])).error, "invalid");
      }
      assert.equal((await rpc("set_sprout_defense", ["11111", ["one"], 99])).error, "conflict");
      assert.deepEqual(await rpc("set_sprout_defense", ["11111", ["one", "three"], 1]), { ok: true });
      const team = await rpc("get_sprout_defense", ["11111"]);
      assert.deepEqual(team.fighters.map((f) => [f.slot, f.fighter_id, f.hp]), [[0, "one", 130], [1, "three", 130]]);
      assert.equal((await db.query("select combat_power from players where discord_user_id='11111'")).rows[0].combat_power, 502);
    });

    await t.test("Fusion save prunes missing defense slots and updates CP atomically", async () => {
      const afterFusion = save();
      afterFusion.game.fighters = [fighter("three"), fighter("fusion-result")];
      assert.equal((await rpc("write_sprout_save", ["11111", afterFusion, 1, 3, 100])).revision, 2);
      const team = await rpc("get_sprout_defense", ["11111"]);
      assert.equal(team.revision, 2);
      assert.deepEqual(team.fighters.map((f) => [f.slot, f.fighter_id]), [[1, "three"]]);
      assert.equal((await db.query("select combat_power from players where discord_user_id='11111'")).rows[0].combat_power, 251);
      const invalid = structuredClone(afterFusion);
      invalid.game.fighters[0].attack = -1;
      await assert.rejects(() => rpc("write_sprout_save", ["11111", invalid, 2, 3, 999]));
      assert.equal((await db.query("select revision from game_saves where discord_user_id='11111'")).rows[0].revision, 2);
      assert.equal((await db.query("select coins from players where discord_user_id='11111'")).rows[0].coins, 100);
      assert.deepEqual(await rpc("set_sprout_defense", ["11111", [], 2]), { ok: true });
      assert.equal((await db.query("select combat_power from players where discord_user_id='11111'")).rows[0].combat_power, 0);
    });

    await t.test("only accepted friends can request a farm snapshot", async () => {
      assert.equal(await rpc("get_sprout_friend_farm", ["22222", "11111"]), null);
      await rpc("change_sprout_friendship", ["22222", "11111", "request"]);
      assert.equal(await rpc("get_sprout_friend_farm", ["22222", "11111"]), null);
      await rpc("change_sprout_friendship", ["11111", "22222", "accept"]);
      assert.ok((await rpc("get_sprout_friend_farm", ["22222", "11111"])).save);
      assert.equal(await rpc("get_sprout_friend_farm", ["33333", "11111"]), null);
    });

    await t.test("RLS and grants block direct browser tables and RPCs", async () => {
      const checks = await db.query("select relname, relrowsecurity from pg_class where relname in ('friend_links','defense_teams','defense_fighters')");
      assert.ok(checks.rows.every((row) => row.relrowsecurity));
      for (const role of ["anon", "authenticated"]) {
        assert.equal((await db.query("select has_table_privilege($1,'public.friend_links','select') as allowed", [role])).rows[0].allowed, false);
        assert.equal((await db.query("select has_function_privilege($1,'public.set_sprout_defense(text,text[],bigint)','execute') as allowed", [role])).rows[0].allowed, false);
      }
    });
  } finally { await db.close(); }
});
