import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync("lib/world-camera.ts", "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = { exports: {} };
new Function("require", "module", "exports", outputText)(() => ({}), loaded, loaded.exports);
const { getFollowCamera, getOverviewCamera, screenToCanonicalWorld } = loaded.exports;

const world = { width: 1447, height: 1087 };

test("follow camera centers an interior target at 1.6 times fit scale", () => {
  const viewport = { width: 800, height: 600 };
  const target = { x: 723.5, y: 543.5 };
  const camera = getFollowCamera(world.width, world.height, viewport, target);
  const fit = Math.min(viewport.width / world.width, viewport.height / world.height);
  assert.equal(camera.scale, fit * 1.6);
  assert.ok(Math.abs(target.x * camera.scale + camera.x - viewport.width / 2) < 0.0001);
  assert.ok(Math.abs(target.y * camera.scale + camera.y - viewport.height / 2) < 0.0001);
});

test("follow camera clamps left, right, top, and bottom edges", () => {
  const viewport = { width: 800, height: 600 };
  const topLeft = getFollowCamera(world.width, world.height, viewport, { x: 0, y: 0 });
  assert.equal(topLeft.x, 0);
  assert.equal(topLeft.y, 0);
  const bottomRight = getFollowCamera(world.width, world.height, viewport, { x: world.width, y: world.height });
  assert.equal(bottomRight.x, viewport.width - world.width * bottomRight.scale);
  assert.equal(bottomRight.y, viewport.height - world.height * bottomRight.scale);
});

test("pointer conversion inverts Overview and Follow camera transforms", () => {
  const origin = { x: 50, y: 25 };
  const canonical = { x: 900, y: 700 };
  const cameras = [
    getOverviewCamera(world.width, world.height, { width: 1000, height: 600 }),
    getFollowCamera(world.width, world.height, { width: 800, height: 600 }, { x: 700, y: 500 }),
  ];
  for (const camera of cameras) {
    const screen = { x: origin.x + camera.x + canonical.x * camera.scale, y: origin.y + camera.y + canonical.y * camera.scale };
    const converted = screenToCanonicalWorld(camera, origin, screen);
    assert.ok(Math.abs(converted.x - canonical.x) < 0.0001);
    assert.ok(Math.abs(converted.y - canonical.y) < 0.0001);
  }
});

test("unusual aspect ratios increase Follow scale enough to cover the viewport", () => {
  for (const viewport of [{ width: 1200, height: 300 }, { width: 300, height: 900 }]) {
    const camera = getFollowCamera(world.width, world.height, viewport, { x: 700, y: 500 });
    assert.ok(world.width * camera.scale >= viewport.width);
    assert.ok(world.height * camera.scale >= viewport.height);
    assert.ok(camera.x <= 0 && camera.x >= viewport.width - world.width * camera.scale);
    assert.ok(camera.y <= 0 && camera.y >= viewport.height - world.height * camera.scale);
  }
});
