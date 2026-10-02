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
      fighters: [{ id: "fighter-1", crop: "potato", mutation: "normal", personality: "protective", hp: 130, attack: 20, defense: 35, speed: 20, level: 1, xp: 0, locked: false, favorite: false }],
      activeTeam: ["fighter-1", null, null],
      teamPresets: [
        { name: "Team 1", front: "fighter-1", rearLeft: null, rearRight: null },
        { name: "Team 2", front: null, rearLeft: null, rearRight: null },
        { name: "Team 3", front: null, rearLeft: null, rearRight: null },
      ],
      defaultTeamPreset: 0,
      ascendantShards: 0,
    },
    world: { farmerTile: { ...FIRST_WORLD.start }, facing: "left" },
  };
}

function validV1Save() {
  const save = validSave();
  delete save.game.farmXp;
  delete save.game.fighters[0].level;
  delete save.game.fighters[0].xp;
  delete save.game.fighters[0].locked;
  delete save.game.fighters[0].favorite;
  delete save.game.activeTeam;
  delete save.game.teamPresets;
  delete save.game.defaultTeamPreset;
  delete save.game.ascendantShards;
  save.version = 1;
  save.game.plots = save.game.plots.slice(0, 9);
  return save;
}

function validV2Save() {
  const save = validSave();
  save.version = 2;
  save.game.fighters = save.game.fighters.map(({ level, xp, locked, favorite, ...fighter }) => fighter);
  delete save.game.activeTeam;
  delete save.game.teamPresets;
  delete save.game.defaultTeamPreset;
  delete save.game.ascendantShards;
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

test("stored natural fighter stats round-trip exactly and are never rerolled", () => {
  const save = validSave();
  Object.assign(save.game.fighters[0], { hp: 183, attack: 21, defense: 33, speed: 19, level: 8, xp: 1080 });
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  const loaded = loadSproutSave(storage);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.save.game.fighters[0], save.game.fighters[0]);
});

test("optional natural roll metadata round-trips while legacy fighters remain valid", () => {
  const save = validSave();
  save.game.fighters[0].naturalStats = { hp: 185, attack: 21, defense: 34, speed: 21 };
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  assert.deepEqual(loadSproutSave(storage).save.game.fighters[0].naturalStats, save.game.fighters[0].naturalStats);
  delete save.game.fighters[0].naturalStats;
  assert.equal(validateSproutSave(save), true);
  const invalid = structuredClone(save);
  invalid.game.fighters[0].naturalStats = { hp: 186, attack: 21, defense: 34, speed: 21 };
  assert.equal(validateSproutSave(invalid), false);
});

test("old V3 fighters default unlocked and lock state persists", () => {
  const old = validSave();
  delete old.game.fighters[0].locked;
  delete old.game.fighters[0].favorite;
  delete old.game.teamPresets;
  delete old.game.defaultTeamPreset;
  delete old.game.ascendantShards;
  const loadedOld = loadSproutSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(old) }));
  assert.equal(loadedOld.status, "loaded");
  assert.equal(loadedOld.save.game.fighters[0].locked, false);
  assert.equal(loadedOld.save.game.fighters[0].favorite, false);
  assert.equal(loadedOld.save.game.teamPresets[0].front, "fighter-1");
  assert.equal(loadedOld.save.game.defaultTeamPreset, 0);
  assert.equal(loadedOld.save.game.ascendantShards, 0);
  loadedOld.save.game.fighters[0].locked = true;
  const storage = memoryStorage();
  assert.equal(writeSproutSave(loadedOld.save, storage), true);
  assert.equal(loadSproutSave(storage).save.game.fighters[0].locked, true);
});

test("fighter metadata, presets, and Ascendant Shards round-trip", () => {
  const save = validSave();
  Object.assign(save.game.fighters[0], { name: "Tater", favorite: true });
  save.game.teamPresets[1] = { name: "Boss Team", front: "fighter-1", rearLeft: null, rearRight: null };
  save.game.defaultTeamPreset = 1;
  save.game.ascendantShards = 4;
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  const loaded = loadSproutSave(storage).save;
  assert.equal(loaded.game.fighters[0].name, "Tater");
  assert.equal(loaded.game.fighters[0].favorite, true);
  assert.equal(loaded.game.teamPresets[1].name, "Boss Team");
  assert.equal(loaded.game.defaultTeamPreset, 1);
  assert.equal(loaded.game.ascendantShards, 4);
});

test("Active Team persists and stale fighter IDs clear safely", () => {
  const save = validSave();
  save.game.fighters.push(
    { ...save.game.fighters[0], id: "fighter-2", locked: true },
    { ...save.game.fighters[0], id: "fighter-3" },
  );
  save.game.activeTeam = ["fighter-1", "fighter-2", "fighter-3"];
  Object.assign(save.game.teamPresets[0], { front: "fighter-1", rearLeft: "fighter-2", rearRight: "fighter-3" });
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  assert.deepEqual(loadSproutSave(storage).save.game.activeTeam, save.game.activeTeam);
  const stale = structuredClone(save);
  stale.game.activeTeam[1] = "released-fighter";
  stale.game.teamPresets[0].rearLeft = "released-fighter";
  const loaded = loadSproutSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(stale) }));
  assert.deepEqual(loaded.save.game.activeTeam, ["fighter-1", null, "fighter-3"]);
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
  assert.deepEqual(loaded.save.game.fighters[0], { ...v1.game.fighters[0], level: 1, xp: 0, locked: false, favorite: false });
  assert.deepEqual(loaded.save.game.activeTeam, [null, null, null]);
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
  assert.deepEqual(migrated.game.fighters[0], { ...original, level: 1, xp: 0, locked: false, favorite: false });
  assert.deepEqual(migrated.game.activeTeam, [null, null, null]);
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

test("Dungeon floor progress and optional Floor 20 telemetry persist in Save V3", () => {
  const save = validSave();
  save.game.dungeon = { highestClearedFloor: 20, floor20FirstClear: { clearedAt: 40_000, team: [
    { crop: "potato", mutation: "ascended", level: 8 },
    { crop: "carrot", mutation: "golden", level: 7 },
    { crop: "corn", mutation: "prismatic", level: 9 },
  ] } };
  const storage = memoryStorage();
  assert.equal(writeSproutSave(save, storage), true);
  assert.deepEqual(loadSproutSave(storage).save.game.dungeon, save.game.dungeon);
  save.game.dungeon.highestClearedFloor = 21;
  assert.equal(validateSproutSave(save), false);
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
