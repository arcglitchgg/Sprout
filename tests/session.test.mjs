import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadSessionRuntime() {
  const source = readFileSync("lib/session-client.ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", output)(() => ({}), loaded, loaded.exports, process);
  return loaded.exports;
}

test("expired requests share one renewal and retry once with the fresh session", async () => {
  const runtime = loadSessionRuntime();
  let renewals = 0;
  let releaseRenewal;
  const renewed = new Promise((resolve) => { releaseRenewal = resolve; });
  const seen = [];
  runtime.configureSessionController({
    session: "expired", renew: async () => { renewals += 1; await renewed; return "fresh"; },
    onRenewed: () => {}, onDisconnected: () => {},
  });
  const request = (session) => { seen.push(session); return Promise.resolve(new Response(null, { status: session === "expired" ? 401 : 200 })); };
  const first = runtime.authenticatedRequest("expired", request);
  const second = runtime.authenticatedRequest("expired", request);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renewals, 1);
  releaseRenewal();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(seen.filter((value) => value === "fresh").length, 2);
});

test("failed renewal disconnects once and blocks repeated network attempts", async () => {
  const runtime = loadSessionRuntime();
  let renewals = 0;
  let disconnects = 0;
  let requests = 0;
  runtime.configureSessionController({
    session: "expired", renew: async () => { renewals += 1; return null; },
    onRenewed: () => {}, onDisconnected: () => { disconnects += 1; },
  });
  const request = async () => { requests += 1; return new Response(null, { status: 401 }); };
  await assert.rejects(() => runtime.authenticatedRequest("expired", request), runtime.SessionDisconnectedError);
  await assert.rejects(() => runtime.authenticatedRequest("expired", request), runtime.SessionDisconnectedError);
  assert.equal(renewals, 1);
  assert.equal(disconnects, 1);
  assert.equal(requests, 1);
});

test("a fresh Activity controller clears disconnected runtime state", async () => {
  const runtime = loadSessionRuntime();
  runtime.configureSessionController({ session: "old", renew: async () => null, onRenewed: () => {}, onDisconnected: () => {} });
  await assert.rejects(() => runtime.authenticatedRequest("old", async () => new Response(null, { status: 401 })), runtime.SessionDisconnectedError);
  runtime.configureSessionController({ session: "new", renew: async () => "newer", onRenewed: () => {}, onDisconnected: () => {} });
  let used;
  const response = await runtime.authenticatedRequest("stale", async (session) => { used = session; return new Response(null, { status: 200 }); });
  assert.equal(response.status, 200);
  assert.equal(used, "new");
});

test("transport logging does not disconnect or touch local save state", async () => {
  const runtime = loadSessionRuntime();
  let disconnects = 0;
  const localSave = { version: 3, marker: "preserved" };
  runtime.configureSessionController({ session: "valid", renew: async () => "fresh", onRenewed: () => {}, onDisconnected: () => { disconnects += 1; } });
  runtime.logRealtimeTransportDisconnect();
  assert.equal(disconnects, 0);
  assert.deepEqual(localSave, { version: 3, marker: "preserved" });
  const response = await runtime.authenticatedRequest("valid", async () => new Response(null, { status: 200 }));
  assert.equal(response.status, 200);
});
