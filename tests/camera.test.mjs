import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync("lib/world-camera.ts", "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = { exports: {} };
new Function("require", "module", "exports", outputText)(() => ({}), loaded, loaded.exports);
const { CAMERA_DRAG_THRESHOLD, CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM, cameraOffsetForAnchor, clampCameraZoom, clampCameraZoomForMode, createCameraClickGuard, getFollowCamera, getOverviewCamera, isCameraDrag, screenToCanonicalWorld } = loaded.exports;

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

test("manual zoom is centralized and clamped", () => {
  assert.equal(clampCameraZoom(0.2), CAMERA_MIN_ZOOM);
  assert.equal(clampCameraZoom(3), CAMERA_MAX_ZOOM);
  assert.equal(clampCameraZoomForMode("overview", CAMERA_MIN_ZOOM), 1);
  assert.equal(clampCameraZoomForMode("follow", CAMERA_MIN_ZOOM), CAMERA_MIN_ZOOM);
  assert.equal(CAMERA_DRAG_THRESHOLD, 6);
});

test("follow zoom and pan remain bounded without revealing empty world edges", () => {
  const viewport = { width: 800, height: 600 };
  const camera = getFollowCamera(world.width, world.height, viewport, { x: 700, y: 500 }, 1.25, { x: 10000, y: -10000 });
  assert.equal(camera.x, 0);
  assert.equal(camera.y, viewport.height - world.height * camera.scale);
});

test("overview preserves its whole-map baseline and pans only on zoomed axes", () => {
  const viewport = { width: 800, height: 600 };
  const normal = getOverviewCamera(world.width, world.height, viewport);
  const belowNormal = getOverviewCamera(world.width, world.height, viewport, 0.75);
  assert.deepEqual(belowNormal, normal);
  const zoomed = getOverviewCamera(world.width, world.height, viewport, 1.6, { x: -100, y: 50 });
  assert.ok(zoomed.scale > normal.scale);
  assert.ok(zoomed.x <= 0 && zoomed.x >= viewport.width - world.width * zoomed.scale);
  assert.ok(zoomed.y <= 0 && zoomed.y >= viewport.height - world.height * zoomed.scale);
});

test("zoom anchor offset keeps the same canonical point beneath the pointer", () => {
  const viewport = { width: 800, height: 600 };
  const target = { x: 700, y: 500 };
  const current = getFollowCamera(world.width, world.height, viewport, target);
  const screen = { x: 300, y: 220 };
  const anchor = screenToCanonicalWorld(current, { x: 0, y: 0 }, screen);
  const base = getFollowCamera(world.width, world.height, viewport, target, 1.3);
  const pan = cameraOffsetForAnchor(base, anchor, screen);
  const zoomed = getFollowCamera(world.width, world.height, viewport, target, 1.3, pan);
  const converted = screenToCanonicalWorld(zoomed, { x: 0, y: 0 }, screen);
  assert.ok(Math.abs(converted.x - anchor.x) < 0.0001);
  assert.ok(Math.abs(converted.y - anchor.y) < 0.0001);
});

test("plain desktop click and stationary mobile tap are not suppressed", () => {
  const guard = createCameraClickGuard();
  assert.equal(isCameraDrag(0, 1), false);
  assert.equal(isCameraDrag(CAMERA_DRAG_THRESHOLD, 1), false);
  assert.equal(guard.consume(1), false);
  assert.equal(guard.consume(7), false);
});

test("drag beyond 6px suppresses only its resulting click", () => {
  const guard = createCameraClickGuard();
  assert.equal(isCameraDrag(CAMERA_DRAG_THRESHOLD + 0.01, 1), true);
  guard.mark([1]);
  assert.equal(guard.consume(1), true);
  assert.equal(guard.consume(1), false);
});

test("pinch is treated as a gesture and cannot trigger movement", () => {
  const guard = createCameraClickGuard();
  assert.equal(isCameraDrag(0, 2), true);
  guard.mark([3, 4]);
  assert.equal(guard.consume(3), true);
  assert.equal(guard.consume(4), true);
  assert.equal(guard.consume(3), false);
});
