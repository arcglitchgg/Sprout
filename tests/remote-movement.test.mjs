import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync("lib/remote-movement.ts", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", output)(() => ({}), loaded, loaded.exports);
const { validMovementPacket, shouldSendMovement, interpolateRemote, createRemoteMovementStore, remoteWorldPlayer } = loaded.exports;
const packet = (userId, seq, overrides = {}) => ({ userId, seq, x: 500, y: 600, facing: "right", moving: true, timestamp: 1000, ...overrides });

test("movement packets validate shape and canonical world bounds", () => {
  assert.equal(validMovementPacket(packet("11111", 1)), true);
  assert.equal(validMovementPacket(packet("11111", 1, { x: 1447, y: 1087 })), true);
  for (const bad of [{ x: -1 }, { x: 1448 }, { y: 1088 }, { y: Number.NaN }, { x: Infinity }, { facing: "up" }, { moving: "yes" }, { seq: 1.5 }, { timestamp: null }, { userId: "spoof" }]) {
    assert.equal(validMovementPacket(packet("11111", 1, bad)), false);
  }
});

test("remote store accepts owner and multiple visitors, rejects stale, duplicate, absent, and local packets", () => {
  const store = createRemoteMovementStore();
  const members = new Set(["11111", "22222", "33333", "44444"]);
  assert.equal(store.apply(packet("11111", 1), members, "22222", 1000), true);
  assert.equal(store.apply(packet("33333", 2), members, "22222", 1000), true);
  assert.equal(store.apply(packet("44444", 3), members, "22222", 1000), true);
  assert.equal(store.getSnapshot().length, 3);
  assert.equal(store.apply(packet("11111", 1, { x: 700 }), members, "22222", 1100), false);
  assert.equal(store.apply(packet("11111", 0), members, "22222", 1100), false);
  assert.equal(store.apply(packet("22222", 4), members, "22222", 1100), false);
  assert.equal(store.apply(packet("55555", 4), members, "22222", 1100), false);
  assert.equal(store.getSnapshot()[0].targetX, 500);
  assert.equal(remoteWorldPlayer(store.getSnapshot()[0], "Owner", "11111").isOwner, true);
  assert.equal(remoteWorldPlayer(store.getSnapshot()[1], "Visitor", "11111").isOwner, false);
  store.retain(new Set(["11111", "33333"]));
  assert.deepEqual(store.getSnapshot().map((entry) => entry.userId), ["11111", "33333"]);
  store.clear();
  assert.equal(store.getSnapshot().length, 0);
});

test("stop packet updates target, motion settles without extrapolation, and send timing prioritizes transitions", () => {
  const store = createRemoteMovementStore();
  const members = new Set(["11111"]);
  store.apply(packet("11111", 1), members, "22222", 1000);
  store.apply(packet("11111", 2, { x: 520, moving: false }), members, "22222", 1100);
  assert.equal(store.getSnapshot()[0].moving, false);
  store.tick(125, 1200);
  assert.equal(store.getSnapshot()[0].currentX, 520);
  store.tick(125, 2200);
  assert.equal(store.getSnapshot()[0].currentX, 520);
  assert.equal(interpolateRemote({ currentX: 0, currentY: 0, targetX: 1000, targetY: 0 }, 16).x, 350);
  assert.equal(shouldSendMovement(null, 0, { moving: false, facing: "right" }), true);
  assert.equal(shouldSendMovement({ moving: false, facing: "right" }, 0, { moving: true, facing: "right" }), true);
  assert.equal(shouldSendMovement({ moving: true, facing: "right" }, 50, { moving: true, facing: "right" }), false);
  assert.equal(shouldSendMovement({ moving: true, facing: "right" }, 110, { moving: true, facing: "right" }), true);
  assert.equal(shouldSendMovement({ moving: true, facing: "right" }, 0, { moving: false, facing: "right" }), true);
});
