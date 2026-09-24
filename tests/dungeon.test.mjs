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

const { applyDungeonVictory, createDungeonEnemyTeam, getDungeonFloorXp, getHighestUnlockedDungeonFloor, isDungeonFloorUnlocked } = load("@/lib/dungeon");

const roster = ["potato", "carrot", "corn", "potato"].map((crop, index) => ({
  id: `fighter-${index}`, crop, mutation: index === 0 ? "ascended" : "normal", personality: "clever",
  hp: 100 + index, attack: 20, defense: 20, speed: 20, level: 1, xp: 0,
}));

function result(id, status = "victory", ids = ["fighter-0", "fighter-1", "fighter-2"]) {
  return {
    id, mode: "dungeon", status, elapsed: 1, log: [], seed: 1, rngState: 1, decisions: [],
    combatants: ids.map((fighterId, slot) => ({ ...roster.find((fighter) => fighter.id === fighterId), side: "player", slot, currentHp: 1, nextActionAt: 1, actions: 1, guardReady: false })),
  };
}

test("floors unlock sequentially and cleared floors remain replayable", () => {
  const initial = { highestClearedFloor: 0 };
  assert.equal(getHighestUnlockedDungeonFloor(initial), 1);
  assert.equal(isDungeonFloorUnlocked(1, initial), true);
  assert.equal(isDungeonFloorUnlocked(2, initial), false);
  assert.equal(applyDungeonVictory(roster, initial, result("locked"), 2, new Set()), null);

  const first = applyDungeonVictory(roster, initial, result("floor-1"), 1, new Set());
  assert.equal(first.progress.highestClearedFloor, 1);
  assert.equal(getHighestUnlockedDungeonFloor(first.progress), 2);
  const replay = applyDungeonVictory(first.fighters, first.progress, result("floor-1-replay"), 1, new Set());
  assert.ok(replay);
  assert.equal(replay.reward.newlyCleared, false);
  assert.equal(replay.progress.highestClearedFloor, 1);
});

test("normal and boss floor XP values match the reward table", () => {
  assert.deepEqual([1, 2, 3, 4, 6, 9, 14, 19].map(getDungeonFloorXp), [10, 12, 14, 16, 20, 26, 36, 46]);
  assert.deepEqual([5, 10, 15, 20].map(getDungeonFloorXp), [40, 60, 80, 100]);
});

test("victory awards only the three participants and cannot double-award", () => {
  const claims = new Set();
  const awarded = applyDungeonVictory(roster, { highestClearedFloor: 0 }, result("once"), 1, claims);
  assert.deepEqual(awarded.fighters.map((fighter) => fighter.xp), [10, 10, 10, 0]);
  assert.equal(awarded.reward.gains.length, 3);
  assert.equal(applyDungeonVictory(awarded.fighters, awarded.progress, result("once"), 1, claims), null);
});

test("loss and draw award no XP or progress", () => {
  for (const status of ["defeat", "draw"]) {
    const claims = new Set();
    assert.equal(applyDungeonVictory(roster, { highestClearedFloor: 0 }, result(status, status), 1, claims), null);
    assert.equal(claims.size, 0);
  }
});

test("boss floors create one, two, three, and final oversized enemy teams", () => {
  const expected = new Map([[5, 1], [10, 2], [15, 3], [20, 1]]);
  for (const [floor, count] of expected) {
    const enemies = createDungeonEnemyTeam(floor);
    assert.equal(enemies.length, count);
    assert.ok(enemies.every((enemy) => enemy.visualScale === (floor === 20 ? 2.2 : 1.8)));
  }
  assert.equal(createDungeonEnemyTeam(4).length, 3);
  assert.ok(createDungeonEnemyTeam(4)[0].hp > createDungeonEnemyTeam(3)[0].hp);
});

test("Floor 20 completion records first-clear telemetry and reaches the dungeon cap", () => {
  const progress = { highestClearedFloor: 19 };
  const awarded = applyDungeonVictory(roster, progress, result("final"), 20, new Set(), 123456);
  assert.equal(awarded.progress.highestClearedFloor, 20);
  assert.equal(getHighestUnlockedDungeonFloor(awarded.progress), 20);
  assert.equal(awarded.reward.xpPerFighter, 100);
  assert.deepEqual(awarded.progress.floor20FirstClear, {
    clearedAt: 123456,
    team: roster.slice(0, 3).map(({ crop, mutation, level }) => ({ crop, mutation, level })),
  });
});
