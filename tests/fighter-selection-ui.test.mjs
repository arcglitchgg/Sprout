import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync("components/FighterCard.tsx", "utf8");
const grid = readFileSync("components/FighterSelectionGrid.tsx", "utf8");
const farmhouse = readFileSync("components/WorldFarmhouseOverlay.tsx", "utf8");

test("FighterCard supports display, compact, and accessible selectable states", () => {
  for (const prop of ["compact", "selectable", "selected", "disabled", "selectionLabel", "formationLabel", "onSelect"]) assert.ok(card.includes(prop), `missing ${prop}`);
  assert.ok(card.includes('type="button"'));
  assert.ok(card.includes("aria-pressed={selected}"));
  assert.ok(card.includes("focus-visible:ring"));
  assert.ok(card.includes("✓"));
});

test("compact cards retain identity, level, stats, and perfect-roll treatment", () => {
  for (const value of ["fighter.name || descriptor", "species} · Lv.", "personalities[fighter.personality]", "STAT_DISPLAY", "fighter-stat-perfect-icon", "✦ MAX"]) assert.ok(card.includes(value), `missing ${value}`);
  assert.ok(card.includes("!compact"), "full-only XP and description content should be conditional");
});

test("shared selection grid reuses roster filtering and responsive columns", () => {
  assert.ok(grid.includes("filterFighterRoster"));
  assert.ok(grid.includes('grid-cols-1'));
  assert.ok(grid.includes('sm:grid-cols-2'));
  assert.ok(grid.includes('lg:grid-cols-3'));
  assert.ok(grid.includes("selectedFighterId === fighter.id"));
  assert.ok(grid.includes("formationLabel"));
});

test("Fusion uses selectable FighterCard without nested card buttons", () => {
  assert.match(farmhouse, /<FighterCard key=\{fighter\.id\} fighter=\{fighter\} compact selectable selected=\{chosen\}/);
  assert.ok(farmhouse.includes("selectionLabel="));
  assert.doesNotMatch(farmhouse, /<button[^>]*>[\s\S]{0,300}<FighterCard key=\{fighter\.id\}/);
});

test("Farmhouse and Fusion source contains no known mojibake", () => {
  assert.doesNotMatch(farmhouse, /Ã|Â|ï¿½|�|â†|âœ|â€”/);
  assert.ok(farmhouse.includes("← All Fusion groups"));
  assert.ok(farmhouse.includes("Next Ascension guaranteed"));
});
