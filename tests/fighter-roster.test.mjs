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

const roster = load("@/lib/fighter-roster");
const { getFusionEligibility } = load("@/lib/fusion");
const fighter = (id, mutation = "golden", crop = "corn", locked = false) => ({ id, crop, mutation, personality: "clever", hp: 100, attack: 20, defense: 20, speed: 20, level: 2, xp: 50, locked });

test("lock toggles persist in roster data and locked fighters cannot release", () => {
  const initial = [fighter("one")];
  const locked = roster.setRosterFighterLocked(initial, "one", true);
  assert.equal(locked[0].locked, true);
  assert.equal(initial[0].locked, false);
  assert.equal(roster.releaseRosterFighter(locked, "one"), null);
});

test("release removes exactly one fighter and stale repeats do nothing", () => {
  const initial = [fighter("one"), fighter("two")];
  const released = roster.releaseRosterFighter(initial, "one");
  assert.equal(released.released.id, "one");
  assert.deepEqual(released.remaining.map((entry) => entry.id), ["two"]);
  assert.equal(roster.releaseRosterFighter(released.remaining, "one"), null);
});

test("locked fighters cannot be Fusion material and do not count toward availability", () => {
  const fighters = [fighter("1"), fighter("2"), fighter("3"), fighter("4", "golden", "corn", true), fighter("5")];
  assert.equal(getFusionEligibility(fighters, ["1", "2", "3", "4"]).valid, false);
  const group = roster.getFusionRosterGroups(fighters).find((entry) => entry.mutation === "golden" && entry.crop === "corn");
  assert.equal(group.ownedCount, 5);
  assert.equal(group.eligibleCount, 4);
  assert.equal(group.fusionCount, 1);
});

test("groups are ordered by rarity then species and Ascended cannot fuse", () => {
  const groups = roster.getFusionRosterGroups([fighter("a", "ascended", "potato")]);
  assert.deepEqual(groups.slice(0, 3).map(({ mutation, crop }) => [mutation, crop]), [["normal", "potato"], ["normal", "carrot"], ["normal", "corn"]]);
  const ascended = groups.find((entry) => entry.mutation === "ascended" && entry.crop === "potato");
  assert.equal(ascended.fusionCount, 0);
  assert.equal(getFusionEligibility([fighter("1", "ascended", "potato"), fighter("2", "ascended", "potato"), fighter("3", "ascended", "potato"), fighter("4", "ascended", "potato")], ["1", "2", "3", "4"]).valid, false);
});

test("release confirmation counts protect Prismatic and Ascended twice", () => {
  assert.equal(roster.getReleaseConfirmationCount("normal"), 1);
  assert.equal(roster.getReleaseConfirmationCount("golden"), 1);
  assert.equal(roster.getReleaseConfirmationCount("prismatic"), 2);
  assert.equal(roster.getReleaseConfirmationCount("ascended"), 2);
});

test("fighter names trim, validate, and preserve the roster", () => {
  const fighters = [fighter("one")];
  assert.equal(roster.renameRosterFighter(fighters, "one", "  Tater Tot  ")[0].name, "Tater Tot");
  assert.equal(roster.renameRosterFighter(fighters, "one", ""), null);
  assert.equal(roster.renameRosterFighter(fighters, "one", "line\nbreak"), null);
  assert.equal(roster.renameRosterFighter(fighters, "one", "x".repeat(21)), null);
});

test("favorite is independent from lock and combined filters compose", () => {
  const fighters = [fighter("one", "golden", "corn"), fighter("two", "large", "corn"), fighter("three", "golden", "potato")];
  const favorite = roster.setRosterFighterFavorite(fighters, "one", true);
  assert.equal(favorite[0].locked, false);
  assert.deepEqual(roster.filterFighterRoster(favorite, "favorites", "corn").map((entry) => entry.id), ["one"]);
  assert.deepEqual(roster.filterFighterRoster(favorite, "golden", "corn").map((entry) => entry.id), ["one"]);
});
