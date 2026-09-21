import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

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

const { fuseFighters, getFusionEligibility, INITIAL_ASCENSION_PITY } = load("@/lib/fusion");
const { retainExistingTeamIds } = load("@/lib/team-selection");
const { SAVE_KEY, loadSproutSave, writeSproutSave } = load("@/lib/save-storage");
const { FIRST_WORLD } = load("@/lib/world-data");
const fighter = (id, crop = "potato", mutation = "normal") => ({ id, crop, mutation, personality: "angry", hp: 1, attack: 1, defense: 1, speed: 1 });
const roster = () => [fighter("a"), fighter("b"), fighter("c"), fighter("d"), fighter("unrelated", "corn")];
const ids = ["a", "b", "c", "d"];

test("requires exactly four distinct existing fighter IDs", () => {
  for (const chosen of [[], ids.slice(0, 3), [...ids, "unrelated"], ["a", "a", "b", "c"], ["a", "b", "c", "missing"]]) {
    assert.equal(fuseFighters(roster(), chosen, () => 0), null);
  }
});

test("rejects mixed species, mixed rarities, and Ascended inputs", () => {
  assert.equal(fuseFighters([fighter("a"), fighter("b"), fighter("c"), fighter("d", "carrot")], ids, () => 0), null);
  assert.equal(fuseFighters([fighter("a"), fighter("b"), fighter("c"), fighter("d", "potato", "large")], ids, () => 0), null);
  for (const mutation of ["ascended"]) {
    assert.equal(fuseFighters(ids.map((id) => fighter(id, "potato", mutation)), ids, () => 0), null);
  }
});

test("Normal fusion preserves the strict 0.70 boundary", () => {
  for (const [roll, expected] of [[0, "normal"], [0.699999, "normal"], [0.70, "large"], [0.99, "large"]]) {
    let calls = 0;
    const fusion = fuseFighters(roster(), ids, () => [roll, 0.2][calls++]);
    assert.equal(fusion.result.mutation, expected);
    assert.equal(calls, 2);
  }
});

test("Large, Golden, and Prismatic upgrades use centralized strict boundaries and retain tier on failure", () => {
  for (const [input, upgraded, chance] of [["large", "golden", 0.30], ["golden", "prismatic", 0.25], ["prismatic", "ascended", 0.35]]) {
    const team = ids.map((id) => fighter(id, "carrot", input));
    for (const [roll, expected] of [[0, upgraded], [chance - 0.000001, upgraded], [chance, input], [0.99, input]]) {
      let calls = 0;
      const fusion = fuseFighters(team, ids, () => [roll, 0.2][calls++]);
      assert.equal(fusion.result.mutation, expected, `${input} roll ${roll}`);
      assert.equal(calls, 2);
      assert.equal(fusion.remaining.length, 1);
      assert.equal(fusion.pity.carrot, input === "prismatic" && expected === input ? 1 : 0);
    }
  }
});

test("third Prismatic attempt guarantees Ascended, resets only that species, and stale IDs cannot advance pity", () => {
  const team = ids.map((id) => fighter(id, "potato", "prismatic"));
  const first = fuseFighters(team, ids, () => 0.99, INITIAL_ASCENSION_PITY);
  assert.equal(first.result.mutation, "prismatic");
  assert.deepEqual(first.pity, { potato: 1, carrot: 0, corn: 0 });
  const carrot = fuseFighters(ids.map((id) => fighter(id, "carrot", "prismatic")), ids, () => 0.99, first.pity);
  assert.deepEqual(carrot.pity, { potato: 1, carrot: 1, corn: 0 });
  const second = fuseFighters(team, ids, () => 0.99, carrot.pity);
  assert.deepEqual(second.pity, { potato: 2, carrot: 1, corn: 0 });
  let calls = 0;
  const third = fuseFighters(team, ids, () => { calls++; return 0.99; }, second.pity);
  assert.equal(third.result.mutation, "ascended");
  assert.equal(calls, 1, "hard pity skips the success roll but still rolls personality");
  assert.deepEqual(third.pity, { potato: 0, carrot: 1, corn: 0 });
  assert.equal(fuseFighters(third.remaining, ids, () => 0, third.pity), null);
  assert.deepEqual(third.pity, { potato: 0, carrot: 1, corn: 0 });
  assert.equal(fuseFighters(ids.map((id) => fighter(id, "potato", "ascended")), ids, () => 0), null);
});

test("Ascended stats are approximately 15% above Prismatic without changing existing tiers", () => {
  const { generateFighter } = load("@/lib/fighters");
  const { FIGHTER_RARITY_MULTIPLIERS } = load("@/lib/game-data");
  assert.equal(FIGHTER_RARITY_MULTIPLIERS.ascended, FIGHTER_RARITY_MULTIPLIERS.prismatic * 1.15);
  const prism = generateFighter({ crop: "potato", mutation: "prismatic" }, () => 0.2);
  const ascended = generateFighter({ crop: "potato", mutation: "ascended" }, () => 0.2);
  assert.equal(ascended.personality, prism.personality);
  for (const stat of ["hp", "attack", "defense", "speed"]) assert.ok(ascended[stat] > prism[stat]);
});

test("fusion creates a fresh ID, personality, and calculated stats; consumes only the four inputs", () => {
  const before = roster();
  const fusion = fuseFighters(before, ids, () => 0.2);
  assert.ok(fusion);
  assert.equal(fusion.result.crop, "potato");
  assert.equal(fusion.result.personality, "protective");
  assert.deepEqual([fusion.result.hp, fusion.result.attack, fusion.result.defense, fusion.result.speed], [130, 20, 35, 20]);
  assert.ok(!before.some((entry) => entry.id === fusion.result.id));
  assert.deepEqual(fusion.remaining.map((entry) => entry.id), ["unrelated", fusion.result.id]);
  assert.deepEqual(before.map((entry) => entry.id), [...ids, "unrelated"]);
  assert.equal(fuseFighters(fusion.remaining, ids, () => 0), null);
  assert.equal(getFusionEligibility(fusion.remaining, ids).valid, false);
});

test("Save V2 round-trips the fused roster without a schema change", () => {
  const fusion = fuseFighters(roster(), ids, () => 0.2);
  const save = {
    version: 2, savedAt: 50000,
    game: {
      coins: 100, farmXp: 42, seeds: { potato: 3, carrot: 0, corn: 0 }, selectedCrop: "potato",
      plots: Array.from({ length: 144 }, (_, id) => ({ id, crop: null, plantedAt: null })),
      harvestedCrops: [], collection: [], fighters: fusion.remaining, ascensionPity: { potato: 2, carrot: 0, corn: 0 },
    },
    world: { farmerTile: FIRST_WORLD.start, facing: "right" },
  };
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  assert.equal(writeSproutSave(save, storage), true);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).game.fighters.length, 2);
  assert.deepEqual(loadSproutSave(storage), { status: "loaded", save });
});

test("old Save V2 without pity still loads; Ascended fighter saves but harvested Ascended is rejected", () => {
  const { validateSproutSave } = load("@/lib/save-storage");
  const save = {
    version: 2, savedAt: 50000,
    game: { coins: 100, farmXp: 0, seeds: { potato: 3, carrot: 0, corn: 0 }, selectedCrop: "potato",
      plots: Array.from({ length: 144 }, (_, id) => ({ id, crop: null, plantedAt: null })),
      harvestedCrops: [], collection: [], fighters: [fighter("ascended", "potato", "ascended")] },
    world: { farmerTile: FIRST_WORLD.start, facing: "right" },
  };
  assert.equal(validateSproutSave(save), true);
  const storage = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; }, removeItem() {} };
  assert.equal(writeSproutSave(save, storage), true);
  assert.equal(loadSproutSave(storage).status, "loaded");
  const invalid = structuredClone(save);
  invalid.game.harvestedCrops = [{ id: "impossible", crop: "potato", mutation: "ascended", baseSellValue: 10, sellValue: 100, harvestedAt: 1 }];
  assert.equal(validateSproutSave(invalid), false);
});

test("Dungeon selection drops missing IDs but keeps surviving formation slots", () => {
  const selected = ["a", "unrelated", "missing"];
  assert.deepEqual(retainExistingTeamIds(selected, roster()), ["a", "unrelated", ""]);
  const fusion = fuseFighters(roster(), ids, () => 0.2);
  assert.deepEqual(retainExistingTeamIds(selected, fusion.remaining), ["", "unrelated", ""]);
});

test("defense snapshot constraint accepts Ascended after the narrow migration", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table public.defense_fighters(mutation text constraint defense_fighters_mutation_check check (mutation in ('normal','large','golden','prismatic')));");
    const migration = readFileSync("supabase/migrations/20260927_ascended_fusion.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await db.exec("insert into public.defense_fighters(mutation) values ('ascended');");
    assert.equal((await db.query("select mutation from public.defense_fighters")).rows[0].mutation, "ascended");
  } finally { await db.close(); }
});
