import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(name) {
  const source = readFileSync(name.replace("@/", "") + ".ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(load, loaded, loaded.exports);
  return loaded.exports;
}

const teams = load("@/lib/team-selection");
const { buildDefenseSnapshot } = load("@/lib/social");
const fighter = (id, locked = false) => ({ id, crop: "potato", mutation: "normal", personality: "clever", hp: 100, attack: 20, defense: 20, speed: 20, level: 1, xp: 0, locked });
const roster = [fighter("front", true), fighter("left"), fighter("right"), fighter("spare")];

test("Active Team accepts distinct owned fighters including locked fighters", () => {
  const next = teams.updateActiveTeam(teams.EMPTY_ACTIVE_TEAM, ["front", "left", "right"], roster);
  assert.deepEqual(next, ["front", "left", "right"]);
  assert.equal(teams.validActiveTeamSelection(next, roster), true);
});

test("duplicate IDs are rejected and incomplete teams remain editable", () => {
  assert.equal(teams.updateActiveTeam(teams.EMPTY_ACTIVE_TEAM, ["front", "front", "right"], roster), null);
  assert.deepEqual(teams.updateActiveTeam(teams.EMPTY_ACTIVE_TEAM, ["front", "", "right"], roster), ["front", null, "right"]);
});

test("released or fused fighters clear their slot without affecting other slots", () => {
  const remaining = roster.filter((entry) => entry.id !== "left");
  assert.deepEqual(teams.normalizeActiveTeam(["front", "left", "right"], remaining), ["front", null, "right"]);
});

test("Dungeon and PvP default selection uses only a complete valid Active Team", () => {
  const active = ["front", "left", "right"];
  assert.deepEqual(teams.getDefaultBattleSelection(active, roster), active);
  assert.deepEqual(teams.getDefaultBattleSelection(["front", null, "right"], roster), ["", "", ""]);
  assert.deepEqual(teams.getDefaultBattleSelection(["front", "missing", "right"], roster), ["", "", ""]);
});

test("manual battle overrides do not mutate Active Team", () => {
  const active = ["front", "left", "right"];
  const manual = teams.getDefaultBattleSelection(active, roster);
  manual[0] = "spare";
  assert.deepEqual(active, ["front", "left", "right"]);
});

test("Active Team changes do not alter the independent Defense Team", () => {
  const defense = buildDefenseSnapshot(roster, ["spare", "left"]);
  const active = teams.updateActiveTeam(teams.EMPTY_ACTIVE_TEAM, ["front", "left", "right"], roster);
  assert.deepEqual(defense.map((entry) => entry.id), ["spare", "left"]);
  assert.deepEqual(active, ["front", "left", "right"]);
});
