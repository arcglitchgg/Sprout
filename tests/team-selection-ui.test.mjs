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

const teamSelector = readFileSync("components/TeamSelector.tsx", "utf8");
const battle = readFileSync("components/Battle.tsx", "utf8");
const pvp = readFileSync("components/WorldPvpOverlay.tsx", "utf8");
const farmhouse = readFileSync("components/WorldFarmhouseOverlay.tsx", "utf8");
const { filterFighterRoster } = load("@/lib/fighter-roster");
const { updateActiveTeam } = load("@/lib/team-selection");
const fighters = [
  { id: "a", crop: "potato", mutation: "normal", favorite: false },
  { id: "b", crop: "carrot", mutation: "large", favorite: true },
  { id: "c", crop: "corn", mutation: "golden", favorite: true },
  { id: "d", crop: "carrot", mutation: "large", favorite: false },
];

test("team slot updates and removal affect only the intended slot", () => {
  assert.deepEqual(updateActiveTeam(["a", "b", "c"], ["a", "d", "c"], fighters), ["a", "d", "c"]);
  assert.deepEqual(updateActiveTeam(["a", "b", "c"], ["a", "", "c"], fighters), ["a", null, "c"]);
  assert.equal(updateActiveTeam(["a", "b", "c"], ["a", "a", "c"], fighters), null);
});

test("team picker combines Favorites, rarity, and species filters", () => {
  assert.deepEqual(filterFighterRoster(fighters, "favorites", "carrot").map((fighter) => fighter.id), ["b"]);
  assert.deepEqual(filterFighterRoster(fighters, "large", "carrot").map((fighter) => fighter.id), ["b", "d"]);
});

test("Farmhouse team presets open the shared card picker with slot-aware controls", () => {
  assert.ok(farmhouse.includes("<TeamSelector"));
  assert.ok(teamSelector.includes("<FighterSelectionGrid"));
  assert.ok(teamSelector.includes("Choose {FORMATION[editingSlot].toUpperCase()}"));
  assert.ok(teamSelector.includes("selectedFighterId={currentId}"));
  assert.ok(teamSelector.includes("Remove Fighter"));
  assert.ok(teamSelector.includes("next[editingSlot] = fighterId"));
});

test("Dungeon presets display compact cards and manual selection uses the same picker", () => {
  assert.ok(battle.includes("<TeamCardPreview"));
  assert.ok(battle.includes("<TeamSelector"));
  assert.ok(battle.includes('setTeamSource("manual")'));
  assert.doesNotMatch(teamSelector, /<select|<option/);
});

test("PvP presets display compact cards and manual selection remains local", () => {
  assert.ok(pvp.includes("<TeamCardPreview"));
  assert.ok(pvp.includes("<TeamSelector"));
  assert.ok(pvp.includes("onSelect={setSelected}"));
  assert.doesNotMatch(pvp, /<option[^>]*>#[\s\S]*HP/);
});

test("picker layout is scrollable and responsive without horizontal fighter options", () => {
  assert.ok(teamSelector.includes("overflow-y-auto"));
  assert.ok(teamSelector.includes("grid-cols-1"));
  assert.ok(teamSelector.includes("sm:grid-cols-2"));
  assert.ok(teamSelector.includes("lg:grid-cols-3"));
  assert.ok(teamSelector.includes("aria-pressed"));
});
