import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync("lib/challenges.ts", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", output)(() => ({}), loaded, loaded.exports);
const { CHALLENGE_MS, validChallengePacket, playerInRange, playerName } = loaded.exports;
const now = 1_000_000;
const members = new Set(["11111", "22222"]);
const packet = { challengeId: "12345678-1234", fromUserId: "11111", toUserId: "22222", createdAt: now, expiresAt: now + CHALLENGE_MS };

test("names prefer display name, then username, then safe fallback", () => {
  assert.equal(playerName("11111", { "11111": { displayName: "Arc", username: "arc" } }), "Arc");
  assert.equal(playerName("11111", { "11111": { displayName: " ", username: "arc" } }), "arc");
  assert.equal(playerName("22222", { "22222": { displayName: "Other", username: "other" } }, { userId: "22222", displayName: "Owner", username: "owner" }), "Owner");
  assert.equal(playerName("33333", {}), "Farmer ...3333");
});

test("challenge packets require distinct present players and a short valid lifetime", () => {
  assert.equal(validChallengePacket(packet, members, now), true);
  for (const invalid of [
    { toUserId: "11111" }, { toUserId: "33333" }, { fromUserId: "33333" }, { challengeId: "bad" },
    { expiresAt: now - 1 }, { expiresAt: now + CHALLENGE_MS + 1 }, { createdAt: now + 6000 },
  ]) assert.equal(validChallengePacket({ ...packet, ...invalid }, members, now), false);
  assert.equal(validChallengePacket(packet, members, packet.expiresAt), false);
});

test("player interaction range uses canonical world distance", () => {
  assert.equal(playerInRange({ x: 100, y: 100 }, { x: 150, y: 100 }), true);
  assert.equal(playerInRange({ x: 100, y: 100 }, { x: 200, y: 100 }), false);
});
