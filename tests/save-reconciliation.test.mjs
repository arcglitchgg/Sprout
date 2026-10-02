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
