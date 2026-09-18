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
const { findPath, findPathToAdjacent } = load("@/lib/pathfinding");
const { FIRST_WORLD: world, WORLD_FIELDS } = load("@/lib/world-data");
const { cellToWorld, worldToCell, displayedToWorld, fieldCell } = load("@/lib/world-coordinates");

const grid = (width, height, blockedPoints = []) => {
  const blocked = Array(width * height).fill(false);
  blockedPoints.forEach(({ x, y }) => { blocked[y * width + x] = true; });
  return blocked;
};

test("finds the shortest four-direction route", () => {
  const path = findPath(grid(5, 5), 5, 5, { x: 0, y: 0 }, { x: 3, y: 2 });
  assert.equal(path.length, 6);
  assert.deepEqual(path[0], { x: 0, y: 0 });
  assert.deepEqual(path.at(-1), { x: 3, y: 2 });
  path.slice(1).forEach((point, index) => {
    const previous = path[index];
    assert.equal(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y), 1);
  });
});

test("routes around blocked tiles", () => {
  const blocked = grid(5, 5, [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]);
  const path = findPath(blocked, 5, 5, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.ok(path.length > 3);
  assert.ok(path.every(({ x, y }) => !blocked[y * 5 + x]));
});

test("returns no route for blocked, unreachable, or out-of-bounds destinations", () => {
  assert.deepEqual(findPath(grid(3, 3, [{ x: 2, y: 2 }]), 3, 3, { x: 0, y: 0 }, { x: 2, y: 2 }), []);
  assert.deepEqual(findPath(grid(3, 3, [{ x: 1, y: 0 }, { x: 0, y: 1 }]), 3, 3, { x: 0, y: 0 }, { x: 2, y: 2 }), []);
  assert.deepEqual(findPath(grid(3, 3), 3, 3, { x: 0, y: 0 }, { x: 3, y: 0 }), []);
});

test("returns the current tile when already at the destination", () => {
  assert.deepEqual(findPath(grid(3, 3), 3, 3, { x: 1, y: 1 }, { x: 1, y: 1 }), [{ x: 1, y: 1 }]);
});

test("finds the shortest reachable tile adjacent to a blocked interaction target", () => {
  const blocked = grid(5, 5, [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 2 }]);
  const result = findPathToAdjacent(blocked, 5, 5, { x: 4, y: 2 }, { x: 2, y: 2 });
  assert.deepEqual(result.destination, { x: 3, y: 2 });
  assert.deepEqual(result.path, [{ x: 4, y: 2 }, { x: 3, y: 2 }]);
});

test("returns null when no adjacent interaction tile can be reached", () => {
  const blocked = grid(3, 3, [{ x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }]);
  assert.equal(findPathToAdjacent(blocked, 3, 3, { x: 0, y: 0 }, { x: 1, y: 1 }), null);
});

test("official world conversions round-trip every navigation cell", () => {
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
    assert.deepEqual(worldToCell(world, cellToWorld(world, { x, y })), { x, y });
  }
  for (const scale of [0.25, 0.6, 1, 1.5]) {
    const point = displayedToWorld(world, { x: 27, y: 41, width: 1447 * scale, height: 1087 * scale }, { x: 27 + 178 * scale, y: 41 + 250 * scale });
    assert.ok(Math.abs(point.x - 178) < 1e-8 && Math.abs(point.y - 250) < 1e-8);
  }
});

test("all entrances and active plot centers are reachable without crossing blocked terrain", () => {
  assert.equal(world.blocked[world.start.y * world.width + world.start.x], false);
  const targets = [...world.buildings.map((b) => [b.label, b.entrance]), ...world.farmPlots.map((p) => [`plot ${p.id}`, p.approach])];
  for (const [label, point] of targets) {
    const cell = worldToCell(world, point);
    const path = findPath(world.blocked, world.width, world.height, world.start, cell);
    assert.ok(path.length, `${label} (${cell.x},${cell.y}) must be reachable`);
    for (const step of path) {
      assert.equal(world.blocked[step.y * world.width + step.x], false);
    }
  }
});

test("field coordinate helpers cover both 8x9 fields with 144 progressive plots", () => {
  assert.equal(world.farmPlots.length, 144);
  assert.equal(new Set(world.farmPlots.map((p) => p.id)).size, 144);
  for (const field of WORLD_FIELDS) {
    for (let row = 0; row < 9; row++) for (let col = 0; col < 8; col++) {
      const bounds = fieldCell(field, col, row);
      const center = worldToCell(world, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
      assert.equal(world.blocked[center.y * world.width + center.x], false);
    }
  }
  assert.throws(() => fieldCell(WORLD_FIELDS[0], 8, 0));
});

test("plot interactions target their centers and routes cross both fields directly", () => {
  for (const plot of world.farmPlots) {
    assert.deepEqual(plot.approach, { x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 });
  }
  for (const field of WORLD_FIELDS) {
    const start = worldToCell(world, { x: field.x, y: field.y + field.height / 2 });
    const end = worldToCell(world, { x: field.x + field.width, y: field.y + field.height / 2 });
    const path = findPath(world.blocked, world.width, world.height, start, end);
    assert.equal(path.length, end.x - start.x + 1);
    assert.ok(path.every((point) => point.y === start.y));
  }
});

test("major water is blocked but bridges and dock remain walkable", () => {
  for (const [point, expected] of [[{ x: 1170, y: 880 }, true], [{ x: 357, y: 150 }, true], [{ x: 310, y: 330 }, false], [{ x: 160, y: 450 }, false], [{ x: 1085, y: 760 }, false]]) {
    const cell = worldToCell(world, point);
    assert.equal(world.blocked[cell.y * world.width + cell.x], expected);
  }
});
