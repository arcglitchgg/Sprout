import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, verify } from "node:crypto";
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
    const base = name.slice(2);
    let source;
    try { source = readFileSync(base + ".ts", "utf8"); } catch { source = readFileSync(base + ".tsx", "utf8"); }
    const loaded = { exports: {} };
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", "process", output)(load, loaded, loaded.exports, process);
    cache.set(name, loaded.exports);
    return loaded.exports;
  }
  return load;
}

test("Realtime token route derives identity from Sprout session and signs a five-minute ES256 JWT", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = { ...privateKey.export({ format: "jwk" }), kid: "test-key" };
  const tokenModule = loader()("@/lib/realtime-token");
  const issued = tokenModule.createRealtimeToken("11111", 1_000_000, JSON.stringify(jwk));
  const [header, body, signature] = issued.token.split(".");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "ES256", typ: "JWT", kid: "test-key" });
  assert.equal(claims.discord_user_id, "11111");
  assert.equal(claims.role, "authenticated");
  assert.equal(claims.exp - claims.iat, 300);
  assert.equal(issued.expiresAt, 1_300_000);
  assert.equal(verify("sha256", Buffer.from(`${header}.${body}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")), true);
  assert.ok(claims.exp <= Math.floor(issued.expiresAt / 1000));
  assert.throws(() => tokenModule.createRealtimeToken("spoofed", 0, JSON.stringify(jwk)));
  const route = loader({
    "@/lib/discord-session": { sessionUserFromRequest: (request) => request.headers.get("authorization") === "Bearer valid" ? "11111" : null },
    "@/lib/realtime-token": { createRealtimeToken: (id) => ({ token: id, expiresAt: 123 }) },
  })("@/app/api/realtime/token/route");
  const url = "https://sprout.test/api/realtime/token";
  assert.equal((await route.POST(new Request(url, { method: "POST" }))).status, 401);
  const response = await route.POST(new Request(url, { method: "POST", headers: { authorization: "Bearer valid" }, body: JSON.stringify({ userId: "22222" }) }));
  assert.equal((await response.json()).token, "11111");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const previousSecret = process.env.SPROUT_SESSION_SECRET;
  const previousJwk = process.env.SUPABASE_REALTIME_SIGNING_JWK;
  process.env.SPROUT_SESSION_SECRET = "test-session-secret-of-at-least-32-characters";
  process.env.SUPABASE_REALTIME_SIGNING_JWK = JSON.stringify(jwk);
  try {
    const real = loader();
    const session = real("@/lib/discord-session").createSproutSession("11111", Date.now() - 3_600_001);
    const actualRoute = real("@/app/api/realtime/token/route");
    const expired = await actualRoute.POST(new Request(url, { method: "POST", headers: { authorization: `Bearer ${session}` } }));
    assert.equal(expired.status, 401);
    const invalid = await actualRoute.POST(new Request(url, { method: "POST", headers: { authorization: "Bearer invalid.token" } }));
    assert.equal(invalid.status, 401);
  } finally {
    if (previousSecret === undefined) delete process.env.SPROUT_SESSION_SECRET; else process.env.SPROUT_SESSION_SECRET = previousSecret;
    if (previousJwk === undefined) delete process.env.SUPABASE_REALTIME_SIGNING_JWK; else process.env.SUPABASE_REALTIME_SIGNING_JWK = previousJwk;
  }
});

test("farm room lifecycle tracks only identity, leaves on switch/return, and marks owner online/offline", async () => {
  const effects = [];
  const stateUpdates = [];
  const channels = [];
  const cleanups = [];
  const hook = loader({
    react: { useState: () => [false, (value) => stateUpdates.push(value)], useEffect: (effect) => effects.push(effect) },
    "@/lib/realtime-client": {
      requestRealtimeToken: async () => ({ token: "signed", expiresAt: Date.now() + 300000 }),
      createRealtimeClient: () => {
        const record = { room: "", removed: false, untracked: false, payload: null, sync: null, status: null };
        channels.push(record);
        const channel = {
          on: (_type, _filter, callback) => { record.sync = callback; return channel; },
          subscribe: (callback) => { record.status = callback; return channel; },
          track: async (payload) => { record.payload = payload; },
          presenceState: () => record.state ?? {},
          untrack: async () => { record.untracked = true; },
        };
        return { realtime: { setAuth: async () => {} }, channel: (room) => { record.room = room; return channel; }, removeChannel: async () => { record.removed = true; }, removeAllChannels: async () => {} };
      },
    },
  })("@/hooks/useFarmPresence");
  const original = { ...process.env };
  const previousWindow = globalThis.window;
  globalThis.window = globalThis;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  try {
    assert.equal(hook.farmRoom("11111"), "farm:11111");
    assert.throws(() => hook.farmRoom("other"));
    hook.useFarmPresence("session", "11111", "11111");
    const leaveHome = effects.pop()();
    cleanups.push(leaveHome);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(channels[0].room, "farm:11111");
    channels[0].status("SUBSCRIBED");
    assert.deepEqual(Object.keys(channels[0].payload).sort(), ["isOwner", "joinedAt", "userId"]);
    assert.equal(channels[0].payload.isOwner, true);
    leaveHome();
    assert.equal(channels[0].untracked, true);
    assert.equal(channels[0].removed, true);
    hook.useFarmPresence("session", "11111", "22222");
    const leaveFriend = effects.pop()();
    cleanups.push(leaveFriend);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(channels[1].room, "farm:22222");
    channels[1].status("SUBSCRIBED");
    assert.equal(channels[1].payload.isOwner, false);
    channels[1].state = { "22222": [{ userId: "22222", isOwner: true, joinedAt: 1 }] };
    channels[1].sync();
    assert.ok(stateUpdates.includes(true));
    assert.deepEqual(hook.presentUserIds(channels[1].state), ["22222"]);
    channels[1].state = {};
    channels[1].sync();
    assert.equal(stateUpdates.at(-2), false);
    leaveFriend();
    assert.equal(channels[1].removed, true);
    hook.useFarmPresence("session", "11111", "11111");
    const returnHome = effects.pop()();
    cleanups.push(returnHome);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(channels[2].room, "farm:11111");
    returnHome();
    assert.equal(channels[2].removed, true);
    assert.equal(hook.ownerIsPresent({ x: [{ userId: "11111", isOwner: false }] }, "11111"), false);
    assert.deepEqual(hook.presentUserIds({ a: [{ userId: "11111" }], b: [{ userId: "22222" }, { userId: "22222" }, { userId: "invalid" }] }), ["11111", "22222"]);
  } finally { cleanups.forEach((cleanup) => cleanup()); process.env = original; globalThis.window = previousWindow; }
});

test("private farm Presence policy allows owner and accepted friend, blocks strangers and Broadcast", async () => {
  const db = new PGlite({ extensions: { pg_trgm } });
  try {
    await db.exec("create schema extensions; create schema realtime; create role anon; create role authenticated; create role service_role bypassrls; create table realtime.messages(extension text, topic text); create function realtime.topic() returns text language sql stable as $$ select current_setting('sprout.test_topic', true) $$;");
    await db.exec(readFileSync("supabase/migrations/20260920_cloud_saves.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260921_social.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260922_farm_presence.sql", "utf8"));
    await db.exec("insert into public.players(discord_user_id,username) values('11111','owner'),('22222','friend'),('33333','stranger'); insert into public.friend_links(user_low,user_high,requested_by,status) values('11111','22222','11111','accepted');");
    const allowed = async (actor, topic) => (await db.query("select public.can_join_sprout_farm($1,$2) as allowed", [topic, actor])).rows[0].allowed;
    assert.equal(await allowed("11111", "farm:11111"), true);
    assert.equal(await allowed("22222", "farm:11111"), true);
    assert.equal(await allowed("33333", "farm:11111"), false);
    assert.equal(await allowed("22222", "farm:33333"), false);
    assert.equal(await allowed("22222", "farm:11111:extra"), false);
    assert.equal(await allowed("22222", "farm:99999"), false);
    const policies = (await db.query("select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='realtime' and tablename='messages' order by policyname")).rows;
    assert.equal(policies.length, 2);
    assert.ok(policies.every((p) => JSON.stringify(p).includes("presence") && !JSON.stringify(p).includes("broadcast")));
    assert.equal((await db.query("select has_function_privilege('anon','public.can_join_sprout_farm(text,text)','execute') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.can_join_sprout_farm(text,text)','execute') as allowed")).rows[0].allowed, true);
  } finally { await db.close(); }
});
