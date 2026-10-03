import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

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

const { createBattle, resolveBattle, advanceBattle } = load("@/lib/battle");
const { createBattlePlayback, applyBattleVisualEvent } = load("@/lib/battle-playback");
const team = (prefix) => ["potato", "carrot", "corn"].map((crop, index) => ({
  id: `${prefix}${index}`, crop, mutation: "normal", personality: index === 0 ? "protective" : "clever",
  hp: 170, attack: 35, defense: 28, speed: 32,
}));

test("complete simulation creates deterministic immutable playback events", () => {
  const first = resolveBattle(createBattle(team("p"), "playback", 73, team("e")));
  const second = resolveBattle(createBattle(team("p"), "playback", 73, team("e")));
  assert.notEqual(first.status, "running");
  assert.deepEqual(first.visualEvents, second.visualEvents);
  assert.equal(first.visualEvents.at(-1).type, "result");
  assert.equal(first.visualEvents.at(-1).status, first.status);
  assert.ok(first.visualEvents.slice(0, -1).every((event, index) => event.type === "action" && event.sequence === index));
});

test("playback reveals exact HP, logs, KO, and result only in event order", () => {
  const battle = resolveBattle(createBattle(team("p"), "playback", 19, team("e")));
  let playback = createBattlePlayback(battle);
  assert.equal(playback.visibleStatus, null);
  assert.equal(playback.visibleLogCount, 0);
  for (const event of battle.visualEvents) {
    playback = applyBattleVisualEvent(playback, event);
    assert.equal(playback.visibleLogCount, event.logEndIndex);
    if (event.type === "action") {
      assert.equal(playback.displayedHp[event.actualTargetId], event.resultingHp);
      assert.equal(event.ko, event.resultingHp === 0);
      assert.equal(playback.visibleStatus, null);
    }
  }
  assert.equal(playback.complete, true);
  assert.equal(playback.visibleStatus, battle.status);
  assert.equal(playback.visibleLogCount, battle.log.length);
});

test("Protective interception is captured as a resolved visual fact", () => {
  let intercepted;
  for (let seed = 0; seed < 300 && !intercepted; seed++) {
    const state = createBattle(team("p"), "intercept", seed, team("e"));
    state.combatants.forEach((fighter) => { fighter.nextActionAt = 10000; });
    Object.assign(state.combatants[0], { crop: "carrot", personality: "angry", nextActionAt: 1000 });
    state.combatants[4].currentHp = 10;
    const result = advanceBattle(state, 1000);
    intercepted = result.visualEvents.find((event) => event.type === "action" && event.interceptedById);
  }
  assert.ok(intercepted);
  assert.equal(intercepted.actualTargetId, intercepted.interceptedById);
  assert.notEqual(intercepted.intendedTargetId, intercepted.actualTargetId);
});

test("PvP preparation and result gating are presentation-only", () => {
  const source = readFileSync("components/FriendlyBattle.tsx", "utf8");
  assert.match(source, /\["3", "2", "1", "FIGHT!", ""\]/);
  assert.match(source, /progress\.complete && final/);
  assert.doesNotMatch(source, /setInterval\(\(\) => setBattle/);
});
