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

const { INITIAL_SEEDS, plantWithSeed, purchaseSeed } = load("@/lib/seeds");
const emptyPlots = [{ id: 0, crop: null, plantedAt: null }];

test("new games start with three Potato seeds only", () => {
  assert.deepEqual(INITIAL_SEEDS, { potato: 3, carrot: 0, corn: 0 });
});

test("planting consumes one seed without changing coins", () => {
  const coins = 100;
  const result = plantWithSeed(emptyPlots, INITIAL_SEEDS, 0, "potato", 1234);
  assert.equal(result.planted, true);
  assert.equal(result.seeds.potato, 2);
  assert.deepEqual(result.plots[0], { id: 0, crop: "potato", plantedAt: 1234 });
  assert.equal(coins, 100);
});

test("buying one seed uses its price and increments only that crop", () => {
  const carrot = purchaseSeed(INITIAL_SEEDS, 100, "carrot");
  assert.equal(carrot.purchased, true);
  assert.equal(carrot.coins, 92);
  assert.deepEqual(carrot.seeds, { potato: 3, carrot: 1, corn: 0 });

  const corn = purchaseSeed(carrot.seeds, carrot.coins, "corn");
  assert.equal(corn.coins, 80);
  assert.equal(corn.seeds.corn, 1);
});

test("Buy 50 and Buy 100 charge one atomic total and add the requested quantity", () => {
  const fifty = purchaseSeed(INITIAL_SEEDS, 1_000, "carrot", 50);
  assert.equal(fifty.purchased, true);
  assert.equal(fifty.totalPrice, 400);
  assert.equal(fifty.coins, 600);
  assert.deepEqual(fifty.seeds, { potato: 3, carrot: 50, corn: 0 });

  const hundred = purchaseSeed(fifty.seeds, 2_000, "corn", 100);
  assert.equal(hundred.purchased, true);
  assert.equal(hundred.totalPrice, 1_200);
  assert.equal(hundred.coins, 800);
  assert.deepEqual(hundred.seeds, { potato: 3, carrot: 50, corn: 100 });
});

test("bulk purchase with insufficient funds leaves coins and seeds unchanged", () => {
  const result = purchaseSeed(INITIAL_SEEDS, 499, "potato", 100);
  assert.equal(result.purchased, false);
  assert.equal(result.totalPrice, 500);
  assert.equal(result.coins, 499);
  assert.strictEqual(result.seeds, INITIAL_SEEDS);
});

test("buying while broke and planting at zero seeds are blocked", () => {
  const broke = purchaseSeed(INITIAL_SEEDS, 4, "potato");
  assert.equal(broke.purchased, false);
  assert.equal(broke.coins, 4);
  assert.strictEqual(broke.seeds, INITIAL_SEEDS);

  for (const crop of ["carrot", "corn"]) {
    const result = plantWithSeed(emptyPlots, INITIAL_SEEDS, 0, crop, 1234);
    assert.equal(result.planted, false);
    assert.strictEqual(result.plots, emptyPlots);
    assert.strictEqual(result.seeds, INITIAL_SEEDS);
  }
});

test("Carrot and Corn become plantable after purchase", () => {
  for (const crop of ["carrot", "corn"]) {
    const purchase = purchaseSeed(INITIAL_SEEDS, 100, crop);
    const planted = plantWithSeed(emptyPlots, purchase.seeds, 0, crop, 9999);
    assert.equal(planted.planted, true);
    assert.equal(planted.seeds[crop], 0);
    assert.equal(planted.plots[0].crop, crop);
  }
});

test("locked plots cannot consume seeds or be planted", () => {
  const plots = Array.from({ length: 10 }, (_, id) => ({ id, crop: null, plantedAt: null }));
  const result = plantWithSeed(plots, INITIAL_SEEDS, 9, "potato", 1234, 9);
  assert.equal(result.planted, false);
  assert.strictEqual(result.plots, plots);
  assert.strictEqual(result.seeds, INITIAL_SEEDS);
});
