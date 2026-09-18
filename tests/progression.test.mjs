import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(name.replace("@/", "") + ".ts", "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}

const progression = load("@/lib/progression");
const { FIRST_WORLD, WORLD_FIELDS } = load("@/lib/world-data");
const { fieldCell } = load("@/lib/world-coordinates");
const { createHarvestedCrop, removeHarvestedCrop, sellHarvestedCrops } = load("@/lib/inventory");

test("farm levels and unlocked plots follow every cumulative threshold", () => {
  progression.FARM_LEVEL_THRESHOLDS.forEach((threshold, index) => {
    assert.equal(progression.getFarmLevel(threshold), index + 1);
    assert.equal(progression.getUnlockedPlotCount(threshold), progression.FARM_LEVEL_PLOT_COUNTS[index]);
    if (threshold > 0) assert.equal(progression.getFarmLevel(threshold - 1), index);
  });
  assert.equal(progression.getFarmLevel(50_000), 10);
  assert.equal(progression.getUnlockedPlotCount(50_000), 144);
});

test("crossing several thresholds reports every level and aggregate unlock delta", () => {
  assert.deepEqual(progression.getCrossedLevels(39, 301), [2, 3, 4, 5]);
  assert.equal(progression.getUnlockedPlotCount(301) - progression.getUnlockedPlotCount(39), 45);
});

test("all plot IDs are unique and the stable first 3x3 and field milestones match the unlock order", () => {
  assert.equal(FIRST_WORLD.farmPlots.length, 144);
  assert.deepEqual(FIRST_WORLD.farmPlots.map((plot) => plot.id), Array.from({ length: 144 }, (_, id) => id));
  for (let id = 0; id < 9; id += 1) {
    const expected = fieldCell(WORLD_FIELDS[0], id % 3, 6 + Math.floor(id / 3));
    const actual = FIRST_WORLD.farmPlots[id];
    assert.deepEqual({ x: actual.x, y: actual.y, width: actual.width, height: actual.height }, expected);
  }
  assert.ok(FIRST_WORLD.farmPlots.slice(0, 72).every((plot) => plot.x < 700));
  assert.ok(FIRST_WORLD.farmPlots.slice(72).every((plot) => plot.x > 800));
});

test("batch selling awards XP per actual unique sold crop and awakening awards only on success", () => {
  const items = [createHarvestedCrop("potato", "normal", 1, "a"), createHarvestedCrop("corn", "golden", 2, "b")];
  const sale = sellHarvestedCrops(items, 0, ["a", "a", "missing"]);
  assert.equal(sale.sold.length * progression.FARM_XP_REWARDS.sell, 2);
  const awakened = removeHarvestedCrop(sale.remaining, "b");
  assert.ok(awakened.item);
  assert.equal(progression.FARM_XP_REWARDS.awaken, 10);
  assert.equal(removeHarvestedCrop(awakened.remaining, "b").item, null);
});

test("battle victory reward boundary accepts one victory ID exactly once", () => {
  const rewarded = new Set();
  assert.equal(progression.claimBattleVictoryReward(rewarded, { id: "battle-1", status: "victory" }), true);
  assert.equal(progression.claimBattleVictoryReward(rewarded, { id: "battle-1", status: "victory" }), false);
  assert.equal(progression.claimBattleVictoryReward(rewarded, { id: "battle-2", status: "defeat" }), false);
  assert.equal(progression.FARM_XP_REWARDS.dungeonVictory, 15);
});
