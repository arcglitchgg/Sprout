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

const { awardFighterXp, FIGHTER_GROWTH_CEILINGS, getEffectiveFighter, getFighterStatMultiplier, getFighterXpProgress, getLevelFromXp, getXpRequiredForNextLevel } = load("@/lib/fighter-progression");
const { FIGHTER_NATURAL_STAT_RANGES, generateFighter } = load("@/lib/fighters");

const fighter = { id: "base", crop: "potato", mutation: "normal", personality: "protective", hp: 130, attack: 20, defense: 35, speed: 20, level: 1, xp: 0 };

test("XP requirement follows the unbounded level formula", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(getXpRequiredForNextLevel), [50, 80, 110, 140, 170]);
  assert.equal(getXpRequiredForNextLevel(20), 620);
});

test("cumulative XP supports multi-level gains and progression beyond level 10", () => {
  assert.equal(getLevelFromXp(49), 1);
  assert.equal(getLevelFromXp(50), 2);
  assert.equal(getLevelFromXp(130), 3);
  const levelElevenXp = Array.from({ length: 10 }, (_, index) => getXpRequiredForNextLevel(index + 1)).reduce((sum, value) => sum + value, 0);
  const awarded = awardFighterXp(fighter, levelElevenXp);
  assert.equal(awarded.level, 11);
  assert.equal(awarded.xp, levelElevenXp);
  assert.equal(fighter.level, 1, "base fighter is not mutated");
});

test("species/stat growth is deterministic, monotonic, and starts near three percent per level", () => {
  for (const crop of ["potato", "carrot", "corn"]) for (const stat of ["hp", "attack", "defense", "speed"]) {
    const stored = stat === "speed" ? 20 : 100;
    const values = [1, 2, 5, 20, 100, 1000].map((level) => getFighterStatMultiplier(crop, stat, level, stored));
    assert.equal(values[0], 1);
    assert.ok(values[1] > 1.029 && values[1] < 1.03);
    assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
    assert.ok(values.every((value) => value <= FIGHTER_GROWTH_CEILINGS[crop][stat]));
  }
  const leveled = { ...fighter, level: 5, xp: 280 };
  const first = getEffectiveFighter(leveled);
  const second = getEffectiveFighter(leveled);
  assert.deepEqual(first, second);
  assert.deepEqual({ hp: leveled.hp, attack: leveled.attack, defense: leveled.defense, speed: leveled.speed }, { hp: 130, attack: 20, defense: 35, speed: 20 });
});

test("species ceilings retain tank, Speed, and ATK identities", () => {
  const level = 10000;
  const potato = getEffectiveFighter({ ...fighter, crop: "potato", hp: 185, attack: 21, defense: 34, speed: 21, level });
  const carrot = getEffectiveFighter({ ...fighter, crop: "carrot", hp: 130, attack: 28, defense: 21, speed: 39, level });
  const corn = getEffectiveFighter({ ...fighter, crop: "corn", hp: 130, attack: 39, defense: 21, speed: 22, level });
  assert.ok(potato.hp > carrot.hp && potato.hp > corn.hp);
  assert.ok(potato.defense > carrot.defense && potato.defense > corn.defense);
  assert.ok(carrot.speed > potato.speed && carrot.speed > corn.speed);
  assert.equal(FIGHTER_GROWTH_CEILINGS.potato.speed, 1.5);
  assert.equal(FIGHTER_GROWTH_CEILINGS.carrot.speed, 2.5);
  assert.equal(FIGHTER_GROWTH_CEILINGS.corn.speed, 1.75);
  assert.ok(getFighterStatMultiplier("carrot", "speed", level) <= 2.5);
  assert.ok(getFighterStatMultiplier("carrot", "speed", level) > 2.49);
  assert.ok(corn.attack > potato.attack && corn.attack > carrot.attack);
});

test("Carrot Speed uses its configured ceiling without mutating stored Lv1 Speed", () => {
  const carrot = { ...fighter, crop: "carrot", speed: 67, level: 10_000 };
  const before = carrot.speed;
  const effective = getEffectiveFighter(carrot);
  assert.equal(carrot.speed, before);
  assert.ok(effective.speed > 100);
  assert.ok(effective.speed >= 167 && effective.speed <= 168);
});

test("high natural rolls remain stronger at high levels", () => {
  for (const crop of ["potato", "carrot", "corn"]) for (const stat of ["hp", "attack", "defense", "speed"]) {
    const range = FIGHTER_NATURAL_STAT_RANGES[crop][stat];
    const base = { ...fighter, crop, [stat]: range.min, level: 1000 };
    assert.ok(getEffectiveFighter({ ...base, [stat]: range.max })[stat] > getEffectiveFighter(base)[stat]);
  }
});

test("newly generated fighters start at level 1 with zero XP", () => {
  const generated = generateFighter({ crop: "corn", mutation: "ascended" }, () => 0.2);
  assert.equal(generated.level, 1);
  assert.equal(generated.xp, 0);
});

test("XP progress reports cumulative XP within the current level", () => {
  assert.deepEqual(getFighterXpProgress({ level: 1, xp: 25 }), { current: 25, required: 50, percent: 50 });
  assert.deepEqual(getFighterXpProgress({ level: 2, xp: 70 }), { current: 20, required: 80, percent: 25 });
});
