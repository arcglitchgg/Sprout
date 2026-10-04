import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(() => ({}), loaded, loaded.exports);
  return loaded.exports;
}

const reconciliation = load("lib/save-reconciliation.ts");
const retry = load("lib/cloud-save-retry.ts");
const save = (savedAt, marker = "save") => ({ version: 3, savedAt, game: { marker }, world: {} });

test("unknown revision is never converted to create-with-null", () => {
  assert.equal(reconciliation.revisionForWrite({ kind: "unknown" }), undefined);
  assert.equal(reconciliation.revisionForWrite({ kind: "none" }), null);
  assert.equal(reconciliation.revisionForWrite({ kind: "known", revision: 7 }), 7);
});

test("newer unsynced local progress is preserved and selected for safe upload", () => {
  assert.equal(reconciliation.chooseStartupSave(save(200, "local"), save(100, "cloud"), null), "local-upload");
  assert.equal(reconciliation.canRetryLocalAfterConflict(save(200), save(100)), true);
});

test("older unacknowledged local progress is preserved as a visible conflict", () => {
  assert.equal(reconciliation.chooseStartupSave(save(100, "local"), save(200, "cloud"), null), "local-conflict");
  assert.equal(reconciliation.canRetryLocalAfterConflict(save(100), save(200)), false);
});

test("acknowledged local cache accepts a clearly newer cloud save", () => {
  assert.equal(reconciliation.chooseStartupSave(save(100, "local"), save(200, "cloud"), { revision: 3, savedAt: 100 }), "cloud");
});

test("conflict recovery is not permanently blocked in the persistence hook", () => {
  const source = readFileSync("hooks/useSproutPersistence.ts", "utf8");
  assert.equal(source.includes("blocked.current"), false);
  assert.ok(source.includes("fetchCloudSave(cloudSession.current)"));
  assert.ok(source.includes("canRetryLocalAfterConflict"));
  assert.ok(source.includes('showStatus("conflict")'));
});

test("cloud initialization failure retains local hydration and visible failure state", () => {
  const source = readFileSync("hooks/useSproutPersistence.ts", "utf8");
  assert.ok(source.includes("setHydration({ complete: true, save: localSave })"));
  assert.ok(source.includes('showStatus("cloud-failed")'));
  assert.ok(source.includes("canWrite.current = true"));
});

test("temporary failures use bounded backoff while permanent failures pause", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 99].map((count) => retry.cloudRetryDelay("server_unavailable", count)), [4000, 5000, 10000, 20000, 30000, 30000]);
  assert.equal(retry.cloudRetryDelay("network", 0), 4000);
  assert.equal(retry.cloudRetryDelay("timeout", 0), 4000);
  for (const kind of ["validation", "payload_too_large", "invalid_response", "unknown"]) assert.equal(retry.cloudRetryDelay(kind, 0), null);
});

test("timeout reconciliation recognizes an already committed save", () => {
  const sending = save(200, "timed-out");
  assert.equal(retry.timedOutSaveCommitted(sending, { save: structuredClone(sending), revision: 11 }), true);
  assert.equal(retry.timedOutSaveCommitted(sending, { save: save(100, "cloud"), revision: 10 }), false);
  assert.equal(retry.timedOutSaveCommitted(sending, { save: null, revision: null }), false);
});

test("hook reconciles timeout before retry and resets retry policy on mutations and success", () => {
  const source = readFileSync("hooks/useSproutPersistence.ts", "utf8");
  const timeout = source.indexOf('failure.kind === "timeout"');
  const reconciliationGet = source.indexOf("await fetchCloudSave(cloudSession.current)", timeout);
  const retrySchedule = source.indexOf('cloudRetryDelay("timeout"', timeout);
  assert.ok(timeout >= 0 && reconciliationGet > timeout && retrySchedule > reconciliationGet);
  assert.match(source, /timedOutSaveCommitted\(sending, remote\)/);
  assert.match(source, /retryPaused\.current = retryDelay === null/);
  assert.ok((source.match(/retryCount\.current = 0/g) ?? []).length >= 3);
  assert.match(source, /writeSproutSave\(latest\.current/);
  assert.match(source, /cloudRevision\.current = UNKNOWN_CLOUD_REVISION/);
});

test("cloud diagnostics expose metadata only and discard payload or token fields", () => {
  const diagnostics = load("lib/cloud-save-diagnostics.ts");
  const original = console.info;
  const calls = [];
  console.info = (...args) => calls.push(args);
  try {
    diagnostics.logCloudSaveDiagnostic("result", {
      attemptId: 7, payloadBytes: 1234, revisionState: "known", revision: 8,
      durationMs: 90, retryCount: 1, errorType: "network",
      save: "private-save-contents", token: "private-session-token",
    });
  } finally { console.info = original; }
  const serialized = JSON.stringify(calls);
  assert.match(serialized, /payloadBytes/);
  assert.doesNotMatch(serialized, /private-save-contents|private-session-token/);
});
