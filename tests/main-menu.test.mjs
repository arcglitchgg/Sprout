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

const menu = load("@/lib/main-menu");
const { getEffectiveFighter } = load("@/lib/fighter-progression");
const { calculateCombatPower } = load("@/lib/social");
const { GUIDE_TOPICS, PATCH_NOTES } = load("@/lib/guide-data");
const fighter = (id, crop, personality, level = 1) => ({ id, crop, mutation: "normal", personality, hp: 100, attack: 20, defense: 15, speed: 25, level, xp: 0, locked: false });
const roster = [fighter("a", "carrot", "angry", 5), fighter("b", "carrot", "mean", 3), fighter("c", "corn", "clever", 2)];
const active = ["a", "b", "c"];

test("Active Team preview uses the existing effective-stat Combat Power formula", () => {
  const expected = calculateCombatPower(roster.map(getEffectiveFighter));
  assert.equal(menu.getActiveTeamCombatPower(active, roster), expected);
  assert.equal(menu.getActiveTeamCombatPower(["a", null, "c"], roster), null);
});

test("team tagline is deterministic and composition-aware", () => {
  assert.equal(menu.getActiveTeamTagline(active, roster), "Carrots first. Questions later.");
  assert.equal(menu.getActiveTeamTagline(active, roster), "Carrots first. Questions later.");
  assert.equal(menu.getActiveTeamTagline(["a", null, "c"], roster), "Three slots. Your next great idea.");
});

test("guide catalog contains the requested destinations with unique IDs", () => {
  const ids = GUIDE_TOPICS.map((topic) => topic.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["getting-started", "farming", "mutations", "awakening", "fighters", "personalities", "fusion", "ascension", "active-team", "dungeon", "pvp", "defense-team"]) assert.ok(ids.includes(id));
});

test("patch notes are local, newest-first entries with concise bullets", () => {
  assert.ok(PATCH_NOTES.length > 0);
  assert.ok(PATCH_NOTES[0].version);
  assert.ok(PATCH_NOTES[0].date);
  assert.ok(PATCH_NOTES[0].bullets.some((bullet) => bullet.includes("Active Team")));
  assert.ok(PATCH_NOTES[0].bullets.some((bullet) => bullet.includes("session renewal")));
});

test("Main Menu sections and contextual guide links are wired", () => {
  const main = readFileSync("components/MainMenu.tsx", "utf8");
  for (const section of ["active-team", "guides", "patch-notes", "account"]) assert.ok(main.includes(`"${section}"`));
  assert.ok(main.includes('initialGuide ? "guides" : "active-team"'));
  const world = readFileSync("components/PixelWorld.tsx", "utf8");
  assert.match(world, /function openGuide\(topic[\s\S]*closeInteraction\(\);[\s\S]*onOpenGuide\(topic\)/);
  const linked = [readFileSync("components/WorldFarmhouseOverlay.tsx", "utf8"), readFileSync("components/WorldDungeonOverlay.tsx", "utf8"), readFileSync("components/WorldFriendsOverlay.tsx", "utf8")].join("\n");
  for (const topic of ["fusion", "ascension", "dungeon", "active-team", "defense-team", "awakening"]) assert.ok(linked.includes(`topic="${topic}"`), `missing ${topic} help link`);
});
