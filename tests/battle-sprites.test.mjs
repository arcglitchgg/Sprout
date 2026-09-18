import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(resolve(name.replace("@/", "") + ".ts"), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loaded = { exports: {} };
  runInNewContext(`(function(require,module,exports){${outputText}\n})`)(load, loaded, loaded.exports);
  cache.set(name, loaded.exports);
  return loaded.exports;
}

const { BATTLE_ANIMATIONS, getBattleAnimation } = load("@/lib/battle-sprite-data");
const species = ["potato", "carrot", "corn"];
const personalities = ["angry", "protective", "lazy", "clever", "mean"];

const pngInfo = (path) => {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
};

test("all fighters map audited idle and normal attack frames", () => {
  for (const crop of species) for (const personality of personalities) {
    assert.equal(getBattleAnimation(crop, personality, "idle").frames.length, 1);
    assert.equal(getBattleAnimation(crop, personality, "normal-attack").frames.length, 3);
  }
});

test("guard and skill mappings include only approved sets", () => {
  const guards = Object.entries(BATTLE_ANIMATIONS).filter(([, value]) => value.guard).map(([key]) => key).sort();
  assert.deepEqual(guards, [
    "carrot:angry", "carrot:clever", "carrot:lazy", "carrot:mean", "carrot:protective",
    "corn:angry", "corn:clever", "corn:lazy", "corn:mean", "potato:mean", "potato:protective",
  ].sort());
  const skills = Object.entries(BATTLE_ANIMATIONS).filter(([, value]) => value.skill).map(([key]) => key).sort();
  assert.deepEqual(skills, ["corn:angry", "corn:lazy", "potato:angry", "potato:lazy"].sort());
});

test("every mapped frame exists, is normalized, transparent, and fits the presentation window", () => {
  for (const [key, animations] of Object.entries(BATTLE_ANIMATIONS)) {
    const [crop] = key.split(":");
    for (const [name, metadata] of Object.entries(animations)) {
      assert.equal(metadata.frames.length, metadata.frameDurationsMs.length);
      assert.ok(metadata.frameDurationsMs.every((duration) => duration > 0));
      const totalDuration = metadata.frameDurationsMs.reduce((total, duration) => total + duration, 0);
      if (name === "normal-attack") assert.equal(totalDuration, 1300);
      if (name === "guard") assert.equal(totalDuration, 1400);
      if (name === "skill") assert.equal(totalDuration, 1900);
      for (const frame of metadata.frames) {
        const path = resolve("public", decodeURIComponent(frame).replace(/^\/assets\//, "assets/"));
        assert.ok(existsSync(path), frame);
        const image = pngInfo(path);
        assert.deepEqual([image.width, image.height], [crop === "carrot" ? 160 : 192, 192]);
        assert.ok(image.colorType === 4 || image.colorType === 6, `${frame} must contain an alpha channel`);
      }
    }
  }
});

test("legacy fallback plus hurt and KO presentation remain available", () => {
  assert.equal(getBattleAnimation("potato", "clever", "guard"), undefined);
  assert.equal(getBattleAnimation("carrot", "angry", "skill"), undefined);
  assert.equal(getBattleAnimation("corn", "protective", "skill"), undefined);
  const component = readFileSync("components/BattleSprite.tsx", "utf8");
  const css = readFileSync("components/battle-arena.css", "utf8");
  assert.match(component, /LegacyBattleSprite/);
  assert.match(css, /@keyframes battle-hit/);
  assert.match(css, /\.battle-ko/);
  assert.match(css, /translateY\(12px\)/);
});

test("protective intercept engages with the attack and returns afterward", () => {
  const arena = readFileSync("components/BattleArena.tsx", "utf8");
  const css = readFileSync("components/battle-arena.css", "utf8");
  assert.match(arena, /INTERCEPT_ENGAGE_DURATION_MS = 350/);
  assert.match(arena, /INTERCEPT_RETURN_DURATION_MS = 400/);
  assert.match(arena, /Boolean\(intercept && \(showingAction \|\| phase === "intercept-return"\)\)/);
  assert.match(arena, /setPhase\("intercept-return"\)/);
  assert.match(css, /@keyframes battle-intercept-engage/);
  assert.match(css, /@keyframes battle-intercept-return/);
});
