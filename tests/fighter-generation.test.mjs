import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(name.replace("@/", "") + ".ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}

const { FIGHTER_NATURAL_STAT_RANGES, generateFighter } = load("@/lib/fighters");

test("every independently rolled natural stat remains inside its species range", () => {
  for (const crop of ["potato", "carrot", "corn"]) for (const roll of [0, 0.25, 0.5, 0.999999]) {
    const values = [roll, roll, roll, roll, 0.6];
    const fighter = generateFighter({ crop, mutation: "normal" }, () => values.shift());
    for (const stat of ["hp", "attack", "defense", "speed"]) {
      const range = FIGHTER_NATURAL_STAT_RANGES[crop][stat];
      assert.ok(fighter[stat] >= range.min && fighter[stat] <= range.max);
    }
  }
});

test("rarity is applied after natural rolls and personality after rarity", () => {
  const values = [0, 0, 0, 0, 0];
  const fighter = generateFighter({ crop: "potato", mutation: "large" }, () => values.shift());
  assert.equal(fighter.personality, "angry");
  assert.deepEqual({ hp: fighter.hp, attack: fighter.attack, defense: fighter.defense, speed: fighter.speed }, {
    hp: 171,
    attack: 24,
    defense: 26,
    speed: 21,
  });
});

test("the four natural stats roll independently before personality", () => {
  const values = [0, 0.999999, 0.5, 0.25, 0.6];
  const fighter = generateFighter({ crop: "corn", mutation: "normal" }, () => values.shift());
  assert.equal(fighter.personality, "clever");
  assert.deepEqual({ hp: fighter.hp, attack: fighter.attack, defense: fighter.defense, speed: fighter.speed }, { hp: 120, attack: 39, defense: 20, speed: 20 });
});
