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

const { awardFighterXp, getEffectiveFighter, getFighterLevelMultiplier, getLevelFromXp, getXpRequiredForNextLevel } = load("@/lib/fighter-progression");
const { generateFighter } = load("@/lib/fighters");

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

test("level scaling is deterministic and leaves generated base stats stable", () => {
  assert.equal(getFighterLevelMultiplier(1), 1);
  assert.equal(getFighterLevelMultiplier(5), 1.12);
  assert.equal(getFighterLevelMultiplier(10), 1.27);
  assert.equal(getFighterLevelMultiplier(20), 1.57);
  const leveled = { ...fighter, level: 5, xp: 280 };
  const first = getEffectiveFighter(leveled);
  const second = getEffectiveFighter(leveled);
  assert.deepEqual(first, second);
  assert.deepEqual({ hp: first.hp, attack: first.attack, defense: first.defense, speed: first.speed }, { hp: 146, attack: 22, defense: 39, speed: 22 });
  assert.deepEqual({ hp: leveled.hp, attack: leveled.attack, defense: leveled.defense, speed: leveled.speed }, { hp: 130, attack: 20, defense: 35, speed: 20 });
});

test("newly generated fighters start at level 1 with zero XP", () => {
  const generated = generateFighter({ crop: "corn", mutation: "ascended" }, () => 0.2);
  assert.equal(generated.level, 1);
  assert.equal(generated.xp, 0);
});
