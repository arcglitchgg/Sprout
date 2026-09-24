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

const { SAVE_KEY, deleteSproutSave, loadSproutSave, migrateV1ToV2, migrateV2ToV3, validateSproutSave, validateSproutSaveV2, writeSproutSave } = load("@/lib/save-storage");
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
    version: 3,
    savedAt: 50_000,
    game: {
      coins: 145,
      farmXp: 305,
      seeds: { potato: 2, carrot: 1, corn: 3 },
      selectedCrop: "carrot",
      plots: Array.from({ length: 144 }, (_, id) => id === 0 ? { id, crop: "potato", plantedAt: 10_000 } : { id, crop: null, plantedAt: null }),
      harvestedCrops: [{ id: "harvest-1", crop: "corn", mutation: "golden", baseSellValue: 30, sellValue: 90, harvestedAt: 20_000 }],
      collection: [{ crop: "corn", mutation: "golden" }],
      fighters: [{ id: "fighter-1", crop: "potato", mutation: "normal", personality: "protective", hp: 130, attack: 20, defense: 35, speed: 20, level: 1, xp: 0 }],
    },
    world: { farmerTile: { ...FIRST_WORLD.start }, facing: "left" },
  };
}

function validV1Save() {
  const save = validSave();
  delete save.game.farmXp;
  delete save.game.fighters[0].level;
  delete save.game.fighters[0].xp;
  save.version = 1;
  save.game.plots = save.game.plots.slice(0, 9);
  return save;
}

function validV2Save() {
  const save = validSave();
  save.version = 2;
  save.game.fighters = save.game.fighters.map(({ level, xp, ...fighter }) => fighter);
  return save;
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

test("V1 migration preserves durable progress and loads through V3", () => {
  const v1 = validV1Save();
  const migrated = migrateV1ToV2(v1);
  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.game.farmXp, 0);
  assert.equal(migrated.game.plots.length, 144);
  assert.deepEqual(migrated.game.plots[0], v1.game.plots[0]);
  assert.deepEqual(migrated.game.plots[143], { id: 143, crop: null, plantedAt: null });
  assert.equal(migrated.game.coins, v1.game.coins);
  assert.deepEqual(migrated.world, v1.world);

  const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(v1) });
  const loaded = loadSproutSave(storage);
  assert.equal(loaded.status, "loaded");
  assert.equal(loaded.save.version, 3);
  assert.deepEqual(loaded.save.game.fighters[0], { ...v1.game.fighters[0], level: 1, xp: 0 });
});

test("V2 migrates to V3 without regenerating fighter identity or base stats", () => {
  const v2 = validV2Save();
  v2.game.fighters[0].mutation = "ascended";
  v2.game.ascensionPity = { potato: 2, carrot: 1, corn: 0 };
  const original = structuredClone(v2.game.fighters[0]);
  assert.equal(validateSproutSaveV2(v2), true);
  const migrated = migrateV2ToV3(v2);
  assert.ok(migrated);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.game.fighters[0], { ...original, level: 1, xp: 0 });
  assert.deepEqual(migrated.game.ascensionPity, v2.game.ascensionPity);
  assert.deepEqual(migrated.game.plots, v2.game.plots);
  assert.deepEqual(migrated.world, v2.world);

  const loaded = loadSproutSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(v2) }));
  assert.deepEqual(loaded, { status: "loaded", save: migrated });
});

test("all 144 V3 plots survive save and load", () => {
  const save = validSave();
  save.game.plots[100] = { id: 100, crop: "corn", plantedAt: 45_000 };
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  const loaded = loadSproutSave(storage).save;
  assert.equal(loaded.game.plots.length, 144);
  assert.deepEqual(loaded.game.plots[100], save.game.plots[100]);
});

test("optional per-species Ascension pity round-trips in V3 and rejects corrupt counters", () => {
  const save = validSave();
  save.game.ascensionPity = { potato: 2, carrot: 1, corn: 0 };
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  assert.deepEqual(loadSproutSave(storage).save.game.ascensionPity, save.game.ascensionPity);
  save.game.ascensionPity.potato = 3;
  assert.equal(validateSproutSave(save), false);
  save.game.ascensionPity.potato = -1;
  assert.equal(validateSproutSave(save), false);
  delete save.game.ascensionPity;
  assert.equal(validateSproutSave(save), true);
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
