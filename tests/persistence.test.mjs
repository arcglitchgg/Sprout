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
  new Function("require", "module", "exports", "process", outputText)(load, loaded, loaded.exports, { env: { NODE_ENV: "production" } });
  cache.set(name, loaded.exports);
  return loaded.exports;
}

const { SAVE_KEY, deleteSproutSave, loadSproutSave, validateSproutSave, writeSproutSave } = load("@/lib/save-storage");
const { FIRST_WORLD } = load("@/lib/world-data");
const { getSecondsRemaining } = load("@/lib/farming");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    raw: values,
  };
}

function validSave() {
  return {
    version: 1,
    savedAt: 50_000,
    game: {
      coins: 145,
      seeds: { potato: 2, carrot: 1, corn: 3 },
      selectedCrop: "carrot",
      plots: Array.from({ length: 9 }, (_, id) => id === 0 ? { id, crop: "potato", plantedAt: 10_000 } : { id, crop: null, plantedAt: null }),
      harvestedCrops: [{ id: "harvest-1", crop: "corn", mutation: "golden", baseSellValue: 30, sellValue: 90, harvestedAt: 20_000 }],
      collection: [{ crop: "corn", mutation: "golden" }],
      fighters: [{ id: "fighter-1", crop: "potato", mutation: "normal", personality: "protective", hp: 130, attack: 20, defense: 35, speed: 20 }],
    },
    world: { farmerTile: { ...FIRST_WORLD.start }, facing: "left" },
  };
}

test("valid durable progress round-trips without transient state", () => {
  const storage = memoryStorage();
  const save = validSave();
  assert.equal(validateSproutSave(save), true);
  assert.equal(writeSproutSave(save, storage), true);
  assert.deepEqual(loadSproutSave(storage), { status: "loaded", save });
  assert.equal("battle" in JSON.parse(storage.getItem(SAVE_KEY)), false);
});

test("planted timestamps survive loading and advance against current time", () => {
  const storage = memoryStorage();
  writeSproutSave(validSave(), storage);
  const loaded = loadSproutSave(storage).save;
  assert.equal(loaded.game.plots[0].plantedAt, 10_000);
  assert.equal(getSecondsRemaining(loaded.game.plots[0], 30_000), 0);
});

test("corrupted structures fall back without partial hydration", () => {
  const corrupted = validSave();
  corrupted.game.plots.pop();
  const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(corrupted) });
  assert.deepEqual(loadSproutSave(storage), { status: "invalid", save: null });
});

test("blocked farmer tiles and duplicate fighter IDs are rejected", () => {
  const blockedIndex = FIRST_WORLD.blocked.findIndex(Boolean);
  const blocked = validSave();
  blocked.world.farmerTile = { x: blockedIndex % FIRST_WORLD.width, y: Math.floor(blockedIndex / FIRST_WORLD.width) };
  assert.equal(validateSproutSave(blocked), false);

  const duplicate = validSave();
  duplicate.game.fighters.push({ ...duplicate.game.fighters[0] });
  assert.equal(validateSproutSave(duplicate), false);
});

test("future saves remain untouched and explicit deletion works", () => {
  const raw = JSON.stringify({ version: 99, future: true });
  const storage = memoryStorage({ [SAVE_KEY]: raw });
  assert.deepEqual(loadSproutSave(storage), { status: "future", save: null });
  assert.equal(storage.getItem(SAVE_KEY), raw);
  deleteSproutSave(storage);
  assert.equal(storage.getItem(SAVE_KEY), null);
});
