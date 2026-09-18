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

const { createHarvestedCrop, harvestPlot, removeHarvestedCrop, sellHarvestedCrop, sellHarvestedCrops } = load("@/lib/inventory");
const { selectAllMarketCrops, selectNormalMarketCrops, summarizeMarketSelection, toggleMarketSelection } = load("@/lib/market");
const { generateFighter } = load("@/lib/fighters");

test("harvesting consecutive ready plots clears each plot and preserves individual items", () => {
  const now = 50_000;
  const plots = [
    { id: 0, crop: "potato", plantedAt: 1_000 },
    { id: 1, crop: "carrot", plantedAt: 1_000 },
  ];
  const first = harvestPlot(plots, [], 0, "golden", now, "harvest-1");
  assert.ok(first);
  const second = harvestPlot(first.plots, first.items, 1, "large", now, "harvest-2");
  assert.ok(second);
  assert.equal(second.plots[0].crop, null);
  assert.equal(second.plots[1].crop, null);
  assert.deepEqual(second.items.map(({ id, crop, mutation, sellValue }) => ({ id, crop, mutation, sellValue })), [
    { id: "harvest-1", crop: "potato", mutation: "golden", sellValue: 30 },
    { id: "harvest-2", crop: "carrot", mutation: "large", sellValue: 27 },
  ]);
});

test("inventory item snapshots base and final sell values", () => {
  assert.deepEqual(createHarvestedCrop("corn", "prismatic", 1234, "corn-1"), {
    id: "corn-1", crop: "corn", mutation: "prismatic", baseSellValue: 30, sellValue: 300, harvestedAt: 1234,
  });
});

test("selling or awakening can remove exactly one selected item", () => {
  const items = [
    createHarvestedCrop("potato", "normal", 1, "a"),
    createHarvestedCrop("corn", "golden", 2, "b"),
  ];
  const sold = sellHarvestedCrop(items, 100, "a");
  assert.equal(sold.item.sellValue, 10);
  assert.equal(sold.coins, 110);
  assert.deepEqual(sold.remaining.map((item) => item.id), ["b"]);

  const fighter = generateFighter(sold.remaining[0]);
  assert.equal(fighter.crop, "corn");
  assert.equal(fighter.mutation, "golden");
  const awakened = removeHarvestedCrop(sold.remaining, "b");
  assert.deepEqual(awakened.remaining, []);
});

test("market selection toggles, selects all or Normal crops, and clears", () => {
  const items = [
    createHarvestedCrop("potato", "normal", 1, "a"),
    createHarvestedCrop("carrot", "large", 2, "b"),
    createHarvestedCrop("corn", "normal", 3, "c"),
  ];
  assert.deepEqual(toggleMarketSelection([], "a"), ["a"]);
  assert.deepEqual(toggleMarketSelection(["a", "b"], "a"), ["b"]);
  assert.deepEqual(selectAllMarketCrops(items), ["a", "b", "c"]);
  assert.deepEqual(selectNormalMarketCrops(items), ["a", "c"]);
  assert.deepEqual(selectAllMarketCrops([]), []);
});

test("batch sale totals selected items once and preserves unselected inventory", () => {
  const items = [
    createHarvestedCrop("potato", "normal", 1, "a"),
    createHarvestedCrop("carrot", "large", 2, "b"),
    createHarvestedCrop("corn", "golden", 3, "c"),
  ];
  const result = sellHarvestedCrops(items, 100, ["a", "c", "c", "missing"]);
  assert.deepEqual(result.sold.map((item) => item.id), ["a", "c"]);
  assert.deepEqual(result.remaining.map((item) => item.id), ["b"]);
  assert.equal(result.total, 100);
  assert.equal(result.coins, 200);
});

test("market summary reports value and requires confirmation only for rare crops", () => {
  const items = [
    createHarvestedCrop("potato", "normal", 1, "a"),
    createHarvestedCrop("carrot", "large", 2, "b"),
    createHarvestedCrop("corn", "golden", 3, "c"),
    createHarvestedCrop("potato", "prismatic", 4, "d"),
  ];
  assert.deepEqual(summarizeMarketSelection(items, ["a", "b"]), { count: 2, total: 37, requiresConfirmation: false });
  assert.equal(summarizeMarketSelection(items, ["c"]).requiresConfirmation, true);
  assert.equal(summarizeMarketSelection(items, ["d"]).requiresConfirmation, true);
  assert.deepEqual(summarizeMarketSelection(items, []), { count: 0, total: 0, requiresConfirmation: false });
});
