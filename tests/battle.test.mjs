import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Run the actual TypeScript engine with its @/ imports, without adding a runtime dependency.
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(resolve(name.replace("@/", "") + ".ts"), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const loaded = { exports: {} };
  runInNewContext(`(function(require,module,exports){${outputText}\n})`)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}
const { createBattle, advanceBattle, actionInterval } = load("@/lib/battle");
const { getActionCandidates, selectActionTarget, rollAction, calculateDamage } = load("@/lib/skill-selection");
const { ACTIONS, SPECIES_ACTIONS } = load("@/lib/skill-data");
const team = ["potato", "carrot", "corn"].map((crop, i) => ({ id: `p${i}`, crop, mutation: "normal", personality: "lazy", hp: 100, attack: 20, defense: 20, speed: 20 }));
const fresh = (seed = 42) => createBattle(team, "test", seed);
const weights = (personality, crop = "potato") => {
  const state = fresh();
  Object.assign(state.combatants[0], { personality, crop });
  return getActionCandidates(state.combatants[0], state.combatants);
};

test("same seed replays exactly, including different clock batches, without mutating inputs", () => {
  const initial = fresh();
  const before = JSON.stringify(initial);
  const expected = advanceBattle(initial, 60000);
  let stepped = fresh();
  for (let time = 100; time <= 60000; time += 100) stepped = advanceBattle(stepped, time);
  assert.equal(JSON.stringify(stepped), JSON.stringify(expected));
  assert.equal(JSON.stringify(initial), before);
  assert.equal(JSON.stringify(advanceBattle(fresh(), 60000)), JSON.stringify(expected));
  assert.notEqual(JSON.stringify(advanceBattle(fresh(99), 60000).decisions), JSON.stringify(expected.decisions));
  assert.equal(team[0].hp, 100);
});

test("exactly basic plus one species skill, with specified damage multipliers", () => {
  for (const [crop, multiplier] of [["potato", 1.4], ["carrot", 1.3], ["corn", 1.6]]) {
    assert.equal(SPECIES_ACTIONS[crop].length, 2);
    const action = ACTIONS[SPECIES_ACTIONS[crop][1]];
    assert.equal(action.attackMultiplier, multiplier);
    assert.equal(calculateDamage(team[0], { ...team[1], currentHp: 100, defense: 0 }, multiplier), Math.round(20 * multiplier));
  }
});

test("base weights and personality modifiers bias both actions without eliminating either", () => {
  const angry = weights("angry");
  const protective = weights("protective");
  assert.equal(angry[0].baseWeight, 60);
  assert.equal(angry[1].baseWeight, 25);
  assert.equal(angry[1].weight, 40);
  assert.equal(protective[0].weight, 78);
  assert.equal(protective[1].weight, 15);
  for (const personality of ["angry", "protective", "lazy", "clever", "mean"]) {
    assert.ok(weights(personality).every((candidate) => candidate.weight > 0));
  }
});

test("species targeting, dead-target exclusion, and rear fallback", () => {
  const state = fresh();
  const actor = { ...state.combatants[0], personality: "angry" };
  const enemies = state.combatants.slice(3);
  enemies[0].currentHp = 5;
  enemies[1].currentHp = 30;
  enemies[2].currentHp = 20;
  enemies[1].defense = 0;
  assert.equal(selectActionTarget(actor, enemies, ACTIONS["heavy-slam"]).slot, 0);
  assert.equal(selectActionTarget(actor, enemies, ACTIONS.backstab).slot, 2);
  assert.equal(selectActionTarget(actor, enemies, ACTIONS["kernel-burst"]).slot, 1);
  enemies[1].currentHp = enemies[2].currentHp = 0;
  assert.equal(selectActionTarget(actor, enemies, ACTIONS.backstab).slot, 0);
});

test("Clever biases higher tactical value but still rolls basics and skills", () => {
  const candidates = weights("clever");
  assert.ok(candidates[1].weight / candidates[1].baseWeight > candidates[0].weight / candidates[0].baseWeight);
  let rng = 0;
  const counts = { basic: 0, "heavy-slam": 0 };
  for (let i = 0; i < 2000; i++) {
    const result = rollAction(candidates, rng);
    rng = result.nextState;
    counts[result.chosen.actionId]++;
  }
  assert.ok(counts.basic > 100 && counts["heavy-slam"] > 100);
  const probability = candidates[1].weight / (candidates[0].weight + candidates[1].weight);
  assert.ok(Math.abs(counts["heavy-slam"] / 2000 - probability) < 0.05);
});

test("Lazy favors high-impact actions without modifying Speed or skipping turns", () => {
  assert.equal(weights("lazy")[1].weight, 100);
  assert.ok(weights("lazy")[1].weight > weights("lazy")[0].weight);
  assert.equal(weights("lazy", "carrot")[1].weight, 50);
  assert.ok(actionInterval(17) > actionInterval(20));
});

test("Mean boosts a skill that can finish, and its damage bonus is strictly below half HP", () => {
  const state = fresh();
  const actor = state.combatants[0];
  actor.personality = "mean";
  const target = state.combatants[3];
  Object.assign(target, { currentHp: 25, defense: 0 });
  const candidates = getActionCandidates(actor, state.combatants);
  assert.equal(candidates[0].weight, 90);
  assert.equal(candidates[1].weight, 112.5);
  assert.ok(candidates[1].reasons.some((reason) => reason.includes("Finisher")));
  assert.equal(calculateDamage(actor, { ...target, hp: 100, currentHp: 50 }), 20);
  assert.equal(calculateDamage(actor, { ...target, hp: 100, currentHp: 49 }), 23);
});

test("Angry reacts to low HP and fallen allies; recent use reduces skill weight", () => {
  const state = fresh();
  const actor = state.combatants[0];
  actor.personality = "angry";
  state.combatants[3].currentHp = 40;
  state.combatants[1].currentHp = 0;
  assert.equal(getActionCandidates(actor, state.combatants)[1].weight, 75);
  actor.lastActionId = "heavy-slam";
  assert.equal(getActionCandidates(actor, state.combatants)[1].weight, 48.75);
});

test("Protective intercepts a species skill once, uses its own DEF, and refreshes after acting", () => {
  let chosen;
  for (let seed = 0; seed < 100; seed++) {
    const state = fresh(seed);
    state.combatants.forEach((fighter) => { fighter.nextActionAt = 10000; });
    Object.assign(state.combatants[0], { crop: "carrot", personality: "angry", nextActionAt: 1000 });
    state.combatants[4].currentHp = 10;
    const result = advanceBattle(state, 1000);
    if (result.decisions[0].chosenAction === "backstab") { chosen = result; break; }
  }
  assert.ok(chosen);
  assert.equal(chosen.decisions[0].intendedTargetId, "enemy-carrot");
  assert.equal(chosen.decisions[0].actualTargetId, "enemy-potato");
  assert.equal(chosen.combatants[4].currentHp, 10);
  assert.equal(chosen.combatants[3].currentHp, 130 - Math.round(20 * 1.3 * 100 / 135));
  assert.equal(chosen.combatants[3].guardReady, false);
  const later = advanceBattle(chosen, 4000);
  assert.equal(later.combatants[4].currentHp, 0);
  assert.equal(advanceBattle(later, 10000).combatants[3].guardReady, true);
  assert.ok(chosen.log.some((event) => event.message.includes("Backstab")));
});

test("seed zero is usable, decisions capture weights, and finished battles stop", () => {
  const result = advanceBattle(fresh(0), 60000);
  assert.ok(result.decisions.length > 0);
  assert.equal(result.decisions[0].rngBefore, 0);
  assert.ok(result.decisions.every((decision) => decision.candidates.length === 2 && decision.roll >= 0 && decision.roll < 1));
  assert.equal(advanceBattle(result, 70000), result);
  assert.ok(!readFileSync("lib/battle.ts", "utf8").includes("Math.random"));
  assert.ok(!readFileSync("lib/skill-selection.ts", "utf8").includes("Math.random"));
});

test("no valid targets yields no candidates; zero or invalid weights cannot win", () => {
  const state = fresh();
  state.combatants.slice(3).forEach((fighter) => { fighter.currentHp = 0; });
  assert.equal(getActionCandidates(state.combatants[0], state.combatants).length, 0);
  const candidates = weights("angry");
  candidates[0].weight = 0;
  assert.equal(rollAction(candidates, 0).chosen.actionId, "heavy-slam");
  candidates[1].weight = NaN;
  assert.throws(() => rollAction(candidates, 0));
});

test("dialogue content cannot alter combat decisions or results", () => {
  const { BATTLE_DIALOGUE } = load("@/lib/battle-data");
  const before = advanceBattle(fresh(), 60000);
  const original = BATTLE_DIALOGUE.lazy;
  BATTLE_DIALOGUE.lazy = "Different cosmetic dialogue.";
  try {
    const after = advanceBattle(fresh(), 60000);
    assert.equal(JSON.stringify(after.decisions), JSON.stringify(before.decisions));
    assert.equal(JSON.stringify(after.combatants), JSON.stringify(before.combatants));
    assert.equal(after.status, before.status);
  } finally { BATTLE_DIALOGUE.lazy = original; }
});

test("victory, defeat, and 60-second draw rules remain intact", () => {
  const win = fresh();
  win.combatants.slice(3).forEach((fighter) => { fighter.currentHp = 0; });
  assert.equal(advanceBattle(win, 0).status, "victory");
  const loss = fresh();
  loss.combatants.slice(0, 3).forEach((fighter) => { fighter.currentHp = 0; });
  assert.equal(advanceBattle(loss, 0).status, "defeat");
  const draw = fresh();
  draw.combatants.forEach((fighter) => { fighter.hp = fighter.currentHp = 100000; });
  const result = advanceBattle(draw, 90000);
  assert.equal(result.status, "draw");
  assert.equal(result.elapsed, 60000);
});

test("dungeon battles safely support one, two, or three enemies", () => {
  const enemies = fresh().combatants.slice(3).map(({ side, slot, currentHp, nextActionAt, actions, guardReady, ...fighter }) => fighter);
  for (const count of [1, 2, 3]) {
    const battle = createBattle(team, `enemy-count-${count}`, 42, enemies.slice(0, count));
    assert.equal(battle.combatants.filter((fighter) => fighter.side === "enemy").length, count);
    assert.doesNotThrow(() => advanceBattle(battle, 60000));
  }
  assert.throws(() => createBattle(team, "none", 42, []));
});
