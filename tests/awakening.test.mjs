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

const { AWAKENING_COSTS, awakenHarvestedCrop } = load("@/lib/awakening");
const { createHarvestedCrop } = load("@/lib/inventory");

const fixedFighter = (source) => ({ id: "fighter-new", crop: source.crop, mutation: source.mutation, personality: "clever", hp: 100, attack: 20, defense: 20, speed: 20 });

test("awakening costs are centralized for every harvestable rarity", () => {
  assert.deepEqual(AWAKENING_COSTS, { normal: 20, large: 40, golden: 100, prismatic: 250 });
});

test("awakening atomically charges, consumes one crop, and creates one fighter", () => {
  const items = [createHarvestedCrop("potato", "normal", 1, "selected"), createHarvestedCrop("corn", "golden", 2, "kept")];
  const existing = [{ ...fixedFighter(items[1]), id: "existing" }];
  const result = awakenHarvestedCrop(items, existing, 100, "selected", fixedFighter);
  assert.equal(result.awakened, true);
  assert.equal(result.coins, 80);
  assert.deepEqual(result.items.map((item) => item.id), ["kept"]);
  assert.deepEqual(result.fighters.map((fighter) => fighter.id), ["existing", "fighter-new"]);
});

test("insufficient coins or a stale item changes nothing", () => {
  const items = [createHarvestedCrop("carrot", "prismatic", 1, "rare")];
  const fighters = [];
  let generated = 0;
  const create = (source) => { generated += 1; return fixedFighter(source); };

  const broke = awakenHarvestedCrop(items, fighters, 249, "rare", create);
  assert.equal(broke.awakened, false);
  assert.equal(broke.reason, "coins");
  assert.strictEqual(broke.items, items);
  assert.strictEqual(broke.fighters, fighters);
  assert.equal(broke.coins, 249);

  const stale = awakenHarvestedCrop(items, fighters, 999, "missing", create);
  assert.equal(stale.awakened, false);
  assert.equal(stale.reason, "missing");
  assert.strictEqual(stale.items, items);
  assert.equal(generated, 0);
});

test("fighter generation failure leaves the source state untouched", () => {
  const items = [createHarvestedCrop("potato", "large", 1, "crop")];
  assert.throws(() => awakenHarvestedCrop(items, [], 100, "crop", () => { throw new Error("generation failed"); }));
  assert.equal(items.length, 1);
});
