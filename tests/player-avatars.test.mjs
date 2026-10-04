import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function loadTypeScript(path) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loaded = { exports: {} };
  runInNewContext(`(function(require,module,exports){${outputText}\n})`)(() => ({}), loaded, loaded.exports);
  return loaded.exports;
}

const {
  DEFAULT_PLAYER_AVATAR_ID,
  NEW_PLAYER_RENDER_SIZE,
  PLAYER_AVATARS,
  getPlayerAvatarFrame,
  normalizePlayerAvatarId,
  resolvePlayerAvatar,
} = loadTypeScript("lib/player-avatar-data.ts");

test("avatar registry contains the legacy fallback and every supplied player sheet", () => {
  assert.equal(DEFAULT_PLAYER_AVATAR_ID, "legacy");
  assert.equal(PLAYER_AVATARS.length, 13);
  for (const avatar of PLAYER_AVATARS) assert.ok(existsSync(`public${avatar.spritePath}`), avatar.spritePath);
  assert.equal(PLAYER_AVATARS.filter((avatar) => avatar.id !== "legacy").every((avatar) => avatar.frameWidth === 16 && avatar.frameHeight === 16), true);
});

test("unknown and absent avatar IDs safely resolve to the original farmer", () => {
  assert.equal(resolvePlayerAvatar().id, "legacy");
  assert.equal(resolvePlayerAvatar("missing").id, "legacy");
  assert.equal(normalizePlayerAvatarId("character-667449"), "character-667449");
});

test("remote avatar IDs use the same registry and safe fallback as local avatars", () => {
  const entity = readFileSync("components/WorldPlayerEntity.tsx", "utf8");
  const layer = readFileSync("components/RemotePlayersLayer.tsx", "utf8");
  assert.match(entity, /player\.selectedCharacterId \?\? player\.avatarId/);
  assert.match(layer, /selectedCharacterId: avatarIds\[remote\.userId\]/);
  assert.equal(resolvePlayerAvatar("character-893205").id, "character-893205");
  assert.equal(resolvePlayerAvatar("unknown-remote-avatar").id, DEFAULT_PLAYER_AVATAR_ID);
});

test("avatar changes retrack Presence without reconnecting the farm room", () => {
  const hook = readFileSync("hooks/useFarmPresence.ts", "utf8");
  assert.match(hook, /useEffect\(\(\) => \{ presenceTrackRef\.current\?\.\(\); \}, \[selectedCharacterId\]\)/);
  assert.doesNotMatch(hook, /\[session, userId, ownerId, selectedCharacterId,/);
  assert.match(hook, /createFarmPresencePayload\(userId!, ownerId!, selectedCharacterIdRef\.current\)/);
});

test("overworld and Main Menu are wired to selectedCharacterId", () => {
  const game = readFileSync("components/SproutGame.tsx", "utf8");
  const world = readFileSync("components/PixelWorld.tsx", "utf8");
  const entity = readFileSync("components/WorldPlayerEntity.tsx", "utf8");
  const menu = readFileSync("components/MainMenu.tsx", "utf8");
  assert.match(game, /world: \{ \.\.\.farmerWorld, selectedCharacterId \}/);
  assert.match(world, /selectedCharacterId,/);
  assert.match(entity, /avatarId=\{player\.selectedCharacterId \?\? player\.avatarId\}/);
  assert.match(menu, /PlayerAvatarSelector/);
});

test("new player sheets keep every walking direction within its own row", () => {
  const avatar = "character-667449";
  for (const [direction, expectedRow] of Object.entries({ down: 0, left: 1, right: 2, up: 3 })) {
    for (const animationFrame of [4, 5, 6, 7, 8, 9]) {
      assert.equal(Math.floor(getPlayerAvatarFrame(avatar, direction, true, animationFrame) / 4), expectedRow);
    }
  }
  assert.notEqual(getPlayerAvatarFrame(avatar, "left", true, 5), getPlayerAvatarFrame(avatar, "right", true, 5));
});

test("stopped players hold the first frame of their last direction", () => {
  const avatar = "character-667449";
  for (const [direction, expectedFrame] of Object.entries({ down: 0, left: 4, right: 8, up: 12 })) {
    assert.equal(getPlayerAvatarFrame(avatar, direction, false, 4), expectedFrame);
    assert.equal(getPlayerAvatarFrame(avatar, direction, false, 9), expectedFrame);
  }
});

test("new avatars retain 16px source frames and render at the reduced foot-anchored size", () => {
  assert.equal(NEW_PLAYER_RENDER_SIZE, 50);
  assert.equal(resolvePlayerAvatar("character-667449").frameWidth, 16);
  const component = readFileSync("components/FarmerSprite.tsx", "utf8");
  assert.match(component, /renderSize = legacy \? 64 : NEW_PLAYER_RENDER_SIZE/);
  assert.match(component, /absolute bottom-0 left-1\/2/);
  assert.match(component, /legacy && facing === "left"/);
});
