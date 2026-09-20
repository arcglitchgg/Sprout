import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => mocks[name] ?? (name === "server-only" ? {} : require(name)), loaded, loaded.exports);
  return loaded.exports;
}

const secret = "a-long-test-session-secret-with-at-least-32-chars";
const sessions = load("lib/discord-session.ts");

test("signed session verifies only the intended user until expiry", () => {
  const issued = sessions.createSproutSession("123456789012345678", 1_000_000, secret);
  assert.equal(sessions.verifySproutSession(issued, 1_000_000, secret), "123456789012345678");
  assert.equal(sessions.verifySproutSession(issued, 1_000_000 + 3_600_000, secret), null);
  assert.equal(sessions.verifySproutSession(issued + "x", 1_000_000, secret), null);
  assert.equal(sessions.verifySproutSession(issued, 1_000_000, "different-long-test-secret-more-than-32-chars"), null);
});

const validSave = { version: 2, game: { coins: 9, farmXp: 40 } };
function routeHarness({ stored = null, write = { revision: 1, updatedAt: "now" } } = {}) {
  const calls = [];
  const route = load("app/api/game/save/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/discord-session": { sessionUserFromRequest: (request) => request.headers.get("authorization") === "Bearer valid" ? "123456789012345678" : null },
    "@/lib/supabase-admin": {
      readCloudSave: async (id) => { calls.push(["read", id]); return stored; },
      writeCloudSave: async (...args) => { calls.push(["write", ...args]); return write; },
    },
    "@/lib/save-storage": { validateSproutSave: (save) => save?.version === 2 && save?.game?.coins === 9 },
  });
  return { route, calls };
}

const request = (body, token = "valid") => new Request("https://sprout.test/api/game/save", {
  method: "PUT", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});

test("save route requires session and never uses spoofed body identity", async () => {
  const { route, calls } = routeHarness();
  assert.equal((await route.PUT(request({ save: validSave, revision: null }, "invalid"))).status, 401);
  assert.equal((await route.PUT(request({ discord_user_id: "attacker", save: validSave, revision: null }))).status, 200);
  assert.equal(calls[0][1], "123456789012345678");
});

test("save route rejects malformed and oversized payloads", async () => {
  const { route } = routeHarness();
  assert.equal((await route.PUT(request({ save: { version: 1 }, revision: null }))).status, 400);
  assert.equal((await route.PUT(request({ save: validSave, revision: null, padding: "x".repeat(1_100_000) }))).status, 413);
});

test("cloud load and revision conflict responses", async () => {
  const { route, calls } = routeHarness({ stored: { save: validSave, revision: 2, updatedAt: "now" }, write: "conflict" });
  const get = await route.GET(new Request("https://sprout.test/api/game/save", { headers: { authorization: "Bearer valid" } }));
  assert.deepEqual(get.body, { save: validSave, revision: 2, updatedAt: "now" });
  assert.equal((await route.PUT(request({ save: validSave, revision: 1 }))).status, 409);
  assert.equal(calls[1][3], 1);
});

test("separate Discord users get separate local cache keys", () => {
  const { discordSaveKey } = load("lib/save-storage.ts", {
    "@/lib/world-data": { FIRST_WORLD: { width: 1, height: 1, blocked: [false] } },
    "@/lib/progression": { TOTAL_FARM_PLOTS: 144 },
  });
  assert.notEqual(discordSaveKey("12345"), discordSaveKey("67890"));
});

test("client protocol loads cloud save and uploads a first revision", async () => {
  const { fetchCloudSave, putCloudSave } = load("lib/cloud-save-client.ts", {
    "@/lib/save-storage": { validateSproutSave: (save) => save?.version === 2 },
  });
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    return options.method === "PUT"
      ? { ok: true, json: async () => ({ revision: 1 }) }
      : { ok: true, json: async () => ({ save: null, revision: null }) };
  };
  try {
    assert.deepEqual(await fetchCloudSave("private-session"), { save: null, revision: null });
    assert.equal(await putCloudSave("private-session", validSave, null), 1);
    assert.equal(JSON.parse(calls[1][1].body).revision, null);
    assert.equal(calls[1][1].headers.Authorization, "Bearer private-session");
  } finally { globalThis.fetch = previous; }
});

test("failed cloud request leaves local save storage untouched", async () => {
  const { putCloudSave } = load("lib/cloud-save-client.ts", {
    "@/lib/save-storage": { validateSproutSave: () => true },
  });
  const previous = globalThis.fetch;
  const local = JSON.stringify(validSave);
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    await assert.rejects(() => putCloudSave("private-session", validSave, 3), /offline/);
    assert.equal(JSON.stringify(validSave), local);
  } finally { globalThis.fetch = previous; }
});
