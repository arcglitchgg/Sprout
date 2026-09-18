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

const { createHarvestedCrop, harvestPlot, removeHarvestedCrop, sellHarvestedCrop } = load("@/lib/inventory");
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
