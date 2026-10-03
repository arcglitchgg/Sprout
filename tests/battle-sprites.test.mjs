import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { validateCharacterSprites } from "../scripts/validate-character-sprites.mjs";

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  if (name.endsWith(".json")) return JSON.parse(readFileSync(resolve(name.replace("@/", "")), "utf8"));
  const source = readFileSync(resolve(name.replace("@/", "") + ".ts"), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } });
  const loaded = { exports: {} };
  runInNewContext(`(function(require,module,exports){${outputText}\n})`)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}

const { FIGHTER_SPRITE_REGISTRY, BATTLE_TO_ASSET_ANIMATION, getBattleAnimation, resolveFighterSprite } = load("@/lib/battle-sprite-data");
const species = ["potato", "carrot", "corn"];
const rarities = ["normal", "large", "golden", "prismatic", "ascended"];
const personalities = ["angry", "protective", "lazy", "clever", "mean"];

test("supplied player and fighter assets pass structural validation", () => {
  const result = validateCharacterSprites();
  assert.deepEqual(result.errors, []);
  assert.equal(result.avatarCount, 12);
  assert.equal(result.fighterCount, 75);
  assert.ok(result.warnings.some((warning) => warning.includes("Nromal")), "the supplied Normal Corn folder typo is reported clearly");
});

test("resolver covers every species, rarity, and personality using real PNG sheets", () => {
  assert.equal(Object.keys(FIGHTER_SPRITE_REGISTRY).length, 75);
  for (const crop of species) for (const mutation of rarities) for (const personality of personalities) {
    const sprite = resolveFighterSprite({ crop, mutation, personality });
    assert.ok(sprite, `${crop}/${mutation}/${personality}`);
    assert.ok(existsSync(resolve("public", sprite.src.slice(1))), sprite.src);
    assert.deepEqual([sprite.sheetWidth, sprite.sheetHeight, sprite.frameWidth, sprite.frameHeight], [128, 128, 32, 32]);
  }
});

test("battle names map to JSON tags and Defense ignores its padded frame", () => {
  assert.equal(JSON.stringify(BATTLE_TO_ASSET_ANIMATION), JSON.stringify({ idle: "idle", "normal-attack": "normal_attack", guard: "defense", skill: "skill" }));
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "idle").frames.length, 4);
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "normal-attack").frames.length, 4);
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "guard").frames.length, 3);
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "skill").frames.length, 4);
  assert.ok(getBattleAnimation("potato", "prismatic", "protective", "guard").frames.every((frame) => frame.x < 96));
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "idle").loop, true);
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "normal-attack").loop, false);
  assert.equal(getBattleAnimation("potato", "prismatic", "protective", "skill").loop, false);
});

test("resolved animation metadata stays stable across arena rerenders", () => {
  assert.equal(
    getBattleAnimation("carrot", "golden", "clever", "idle"),
    getBattleAnimation("carrot", "golden", "clever", "idle"),
  );
  assert.equal(
    getBattleAnimation("carrot", "golden", "clever", "normal-attack"),
    getBattleAnimation("carrot", "golden", "clever", "normal-attack"),
  );
});

test("arena maps waiting, basic attacks, skills, and reactions to sprite tags", () => {
  const arena = readFileSync("components/BattleArena.tsx", "utf8");
  const sprite = readFileSync("components/BattleSprite.tsx", "utf8");
  assert.match(sprite, /animation = "idle"/);
  assert.match(arena, /actionId === "basic" \? "normal-attack"/);
  assert.match(arena, /: "skill" as const/);
  assert.match(arena, /phase === "reaction" && event\?\.actualTargetId === fighter\.id && !intercept/);
  assert.match(arena, /\? "guard"/);
  assert.match(arena, /setActive\(null\)/);
});

test("missing combinations fall back and opposing fighters retain inward mirroring", () => {
  assert.equal(resolveFighterSprite({ crop: "tomato", mutation: "normal", personality: "angry" }), null);
  const component = readFileSync("components/BattleSprite.tsx", "utf8");
  assert.match(component, /LegacyBattleSprite/);
  assert.match(component, /side === "enemy"/);
  assert.match(component, /scaleX\(-1\)/);
  const css = readFileSync("components/battle-arena.css", "utf8");
  assert.match(css, /@keyframes battle-hit/);
  assert.match(css, /\.battle-ko/);
});

test("protective intercept presentation remains unchanged", () => {
  const arena = readFileSync("components/BattleArena.tsx", "utf8");
  const css = readFileSync("components/battle-arena.css", "utf8");
  assert.match(arena, /INTERCEPT_ENGAGE_DURATION_MS = 350/);
  assert.match(arena, /INTERCEPT_RETURN_DURATION_MS = 400/);
  assert.match(arena, /setPhase\("intercept-return"\)/);
  assert.match(css, /@keyframes battle-intercept-engage/);
});
