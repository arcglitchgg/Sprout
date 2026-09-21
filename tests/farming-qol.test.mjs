import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

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

test("short Presence gaps retain one remote user despite duplicate tabs, then expire", () => {
  const { reconcilePresence, PRESENCE_GRACE_MS } = load("@/lib/presence-grace");
  assert.equal(PRESENCE_GRACE_MS, 8000);
  const deadlines = new Map();
  const before = new Set(["11111", "22222"]);
  const gone = reconcilePresence(before, new Set(["11111"]), deadlines, 1000);
  assert.deepEqual([...gone.effective].sort(), ["11111", "22222"]);
  assert.deepEqual(gone.expired, []);
  const returned = reconcilePresence(gone.effective, new Set(["11111", "22222"]), deadlines, 7000);
  assert.equal(deadlines.has("22222"), false);
  assert.equal(returned.effective.has("22222"), true);
  const absent = reconcilePresence(returned.effective, new Set(["11111"]), deadlines, 8000);
  assert.equal(reconcilePresence(absent.effective, new Set(["11111"]), deadlines, 15999).effective.has("22222"), true);
  const expired = reconcilePresence(absent.effective, new Set(["11111"]), deadlines, 16000);
  assert.deepEqual(expired.expired, ["22222"]);
  assert.equal(expired.effective.has("22222"), false);
  // A still-observed user (for example, a second tab) never enters grace.
  const oneTabStillPresent = reconcilePresence(new Set(["22222"]), new Set(["22222"]), deadlines, 17000);
  assert.equal(oneTabStillPresent.effective.has("22222"), true);
  assert.equal(deadlines.has("22222"), false);
});

test("quick planting consumes one selected seed and refuses zero, locked, and growing plots", () => {
  const { plantWithSeed } = load("@/lib/seeds");
  const plots = [{ id: 0, crop: null, plantedAt: null }, { id: 1, crop: "corn", plantedAt: 1 }, { id: 9, crop: null, plantedAt: null }];
  const seeds = { potato: 2, carrot: 0, corn: 0 };
  const first = plantWithSeed(plots, seeds, 0, "potato", 1000, 9);
  assert.equal(first.planted, true);
  assert.equal(first.seeds.potato, 1);
  assert.equal(first.plots[0].crop, "potato");
  assert.equal(plantWithSeed(first.plots, first.seeds, 0, "potato", 2000, 9).planted, false);
  assert.equal(plantWithSeed(plots, seeds, 0, "carrot", 1000, 9).planted, false);
  assert.equal(plantWithSeed(plots, seeds, 1, "potato", 1000, 9).planted, false);
  assert.equal(plantWithSeed(plots, seeds, 9, "potato", 1000, 9).planted, false);
});

test("Harvest All snapshots only ready unlocked crops, rolls each mutation, and preserves growing crops", () => {
  const { harvestReadyPlots } = load("@/lib/inventory");
  const plots = [
    { id: 0, crop: "potato", plantedAt: 1000 },
    { id: 1, crop: "carrot", plantedAt: 1000 },
    { id: 2, crop: "corn", plantedAt: 29000 },
    { id: 9, crop: "potato", plantedAt: 1000 },
  ];
  let rolls = 0, ids = 0;
  const result = harvestReadyPlots(plots, [], 9, 31000, () => ["normal", "golden"][rolls++], () => `item-${++ids}`);
  assert.equal(rolls, 2);
  assert.equal(result.harvested.length, 2);
  assert.deepEqual(result.harvested.map((item) => [item.crop, item.mutation, item.sellValue]), [["potato", "normal", 10], ["carrot", "golden", 54]]);
  assert.deepEqual(result.plots.map((plot) => plot.crop), [null, null, "corn", "potato"]);
  assert.equal(result.items.length, 2);
  assert.equal(load("@/lib/progression").FARM_XP_REWARDS.harvest * result.harvested.length, 10);
  assert.equal(harvestReadyPlots(result.plots, result.items, 9, 31000, () => { throw Error("No roll expected"); }).harvested.length, 0);
  assert.equal(plots[0].crop, "potato", "input snapshot stays intact");
});

test("useGame Harvest All awards XP and one aggregate notification exactly once", () => {
  const writes = [];
  const react = { useState: (initial) => {
    const value = typeof initial === "function" ? initial() : initial;
    return [value, (next) => writes.push(next)];
  }, useRef: (value) => ({ current: value }), useCallback: (fn) => fn, useEffect: () => {} };
  const modules = new Map();
  function hookedLoad(name) {
    if (name === "react") return react;
    if (modules.has(name)) return modules.get(name);
    if (!name.startsWith("@/")) return require(name);
    const source = readFileSync(name.slice(2) + ".ts", "utf8");
    const loaded = { exports: {} };
    new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(hookedLoad, loaded, loaded.exports);
    modules.set(name, loaded.exports);
    return loaded.exports;
  }
  const plots = Array.from({ length: 144 }, (_, id) => ({ id, crop: null, plantedAt: null }));
  plots[0] = { id: 0, crop: "potato", plantedAt: 1000 };
  plots[1] = { id: 1, crop: "carrot", plantedAt: 1000 };
  plots[2] = { id: 2, crop: "corn", plantedAt: 30000 };
  plots[9] = { id: 9, crop: "potato", plantedAt: 1000 };
  const notices = [];
  const game = hookedLoad("@/hooks/useGame").useGame({ coins: 100, farmXp: 0, selectedCrop: "potato", seeds: { potato: 3, carrot: 0, corn: 0 }, plots, collection: [], harvestedCrops: [], fighters: [] }, (notice) => notices.push(notice));
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    assert.equal(game.harvestAll(31000), 2);
    assert.equal(game.harvestAll(31000), 0);
  } finally { Math.random = random; }
  assert.equal(writes.filter((value) => value === 10).length, 1, "two crops award 10 XP in one update");
  assert.equal(writes.filter((value) => Array.isArray(value) && value.length === 2 && value[0]?.baseSellValue !== undefined).length, 1, "inventory changes once");
  assert.equal(notices.length, 1);
  assert.match(notices[0].title, /Harvested 2 crops/);
  assert.match(notices[0].detail, /2 Normal/);
});
