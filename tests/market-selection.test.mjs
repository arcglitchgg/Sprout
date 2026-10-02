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

const { createHarvestedCrop } = load("@/lib/inventory");
const { clearMarketSelection, filterMarketCrops, getMarketSelectAllLabel, selectVisibleMarketCrops, summarizeMarketSelection } = load("@/lib/market");
const items = [
  createHarvestedCrop("potato", "normal", 1, "normal-potato"),
  createHarvestedCrop("potato", "large", 2, "large-potato"),
  createHarvestedCrop("carrot", "large", 3, "large-carrot-a"),
  createHarvestedCrop("carrot", "large", 4, "large-carrot-b"),
  createHarvestedCrop("corn", "golden", 5, "golden-corn"),
  createHarvestedCrop("potato", "prismatic", 6, "prismatic-potato"),
];

test("mutation filters show only matching crops", () => {
  assert.deepEqual(filterMarketCrops(items, "large", "all").map((item) => item.id), ["large-potato", "large-carrot-a", "large-carrot-b"]);
  assert.deepEqual(filterMarketCrops(items, "golden", "all").map((item) => item.id), ["golden-corn"]);
});

test("mutation and species filters combine", () => {
  assert.deepEqual(filterMarketCrops(items, "large", "carrot").map((item) => item.id), ["large-carrot-a", "large-carrot-b"]);
  assert.equal(getMarketSelectAllLabel("large", "carrot"), "Select All Large Carrots");
});

test("context-aware Select All adds only visible crops and preserves earlier selection", () => {
  assert.deepEqual(selectVisibleMarketCrops(items, [], "large", "all"), ["large-potato", "large-carrot-a", "large-carrot-b"]);
  assert.deepEqual(selectVisibleMarketCrops(items, ["normal-potato"], "large", "carrot"), ["normal-potato", "large-carrot-a", "large-carrot-b"]);
  assert.deepEqual(selectVisibleMarketCrops(items, [], "all", "all"), items.map((item) => item.id));
});

test("dynamic bulk labels cover every mutation", () => {
  assert.equal(getMarketSelectAllLabel("all", "all"), "Select All");
  for (const mutation of ["normal", "large", "golden", "prismatic"]) assert.equal(getMarketSelectAllLabel(mutation, "all"), `Select All ${mutation[0].toUpperCase()}${mutation.slice(1)}`);
});

test("selection remains independent of visibility, can clear, and totals stay unchanged", () => {
  const selected = ["normal-potato", "golden-corn"];
  assert.deepEqual(filterMarketCrops(items, "large", "all").map((item) => item.id), ["large-potato", "large-carrot-a", "large-carrot-b"]);
  assert.equal(summarizeMarketSelection(items, selected).count, 2);
  assert.equal(summarizeMarketSelection(items, selected).total, items[0].sellValue + items[4].sellValue);
  assert.deepEqual(clearMarketSelection(), []);
});
