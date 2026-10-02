import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const cache = new Map();
function load(name) { if (cache.has(name)) return cache.get(name); const source = readFileSync(name.replace("@/", "") + ".ts", "utf8"); const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText; const loaded = { exports: {} }; new Function("require", "module", "exports", output)(load, loaded, loaded.exports); cache.set(name, loaded.exports); return loaded.exports; }
const shards = load("@/lib/ascendant-shards");
const fighter = (id, mutation = "ascended", locked = false, favorite = false) => ({ id, crop: "corn", mutation, personality: "clever", hp: 100, attack: 20, defense: 20, speed: 20, level: 1, xp: 0, locked, favorite });
const presets = [
  { name: "Team 1", front: "one", rearLeft: "other", rearRight: null },
  { name: "Team 2", front: "one", rearLeft: null, rearRight: null },
  { name: "Team 3", front: null, rearLeft: null, rearRight: null },
];
test("Ascended dismantle is atomic and cleans all team references", () => { const result = shards.dismantleAscendedFighter([fighter("one"), fighter("other", "normal")], presets, 2, "one"); assert.equal(result.shards, 3); assert.deepEqual(result.remaining.map((entry) => entry.id), ["other"]); assert.equal(result.presets[0].front, null); assert.equal(result.presets[1].front, null); assert.equal(shards.dismantleAscendedFighter(result.remaining, result.presets, result.shards, "one"), null); });
test("locked and non-Ascended fighters cannot be dismantled", () => { assert.equal(shards.dismantleAscendedFighter([fighter("one", "ascended", true)], presets, 0, "one"), null); assert.equal(shards.dismantleAscendedFighter([fighter("one", "golden")], presets, 0, "one"), null); });
test("favorite dismantling requires a stronger two-step confirmation", () => { assert.equal(shards.getDismantleConfirmationCount(false), 1); assert.equal(shards.getDismantleConfirmationCount(true), 2); });
