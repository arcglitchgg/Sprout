export type PlayerAvatarDefinition = {
  id: string;
  name: string;
  spritePath: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
};

export const DEFAULT_PLAYER_AVATAR_ID = "legacy";
export type PlayerMovementDirection = "down" | "left" | "right" | "up";
export const PLAYER_DIRECTION_ROWS: Record<PlayerMovementDirection, number> = { down: 0, left: 1, right: 2, up: 3 };
export const NEW_PLAYER_RENDER_SIZE = 50;
const root = "/assets/Character sprites/New Player Character";
const ids = ["478847", "666620", "666623", "666626", "666968", "667375", "667449", "893205", "893206", "893216", "893223", "893225"];

export const PLAYER_AVATARS: PlayerAvatarDefinition[] = [
  { id: DEFAULT_PLAYER_AVATAR_ID, name: "Original Farmer", spritePath: "/assets/Pixel Farm_Assets/Pixel Farm_Assets/PixelFarm_Farmer-Sheet.png", sheetWidth: 128, sheetHeight: 96, frameWidth: 32, frameHeight: 32 },
  ...ids.map((id, index) => ({ id: `character-${id}`, name: `Farmer ${index + 1}`, spritePath: `${root}/character_${id}.png`, sheetWidth: 64, sheetHeight: 64, frameWidth: 16, frameHeight: 16 })),
];

const avatarsById = new Map(PLAYER_AVATARS.map((avatar) => [avatar.id, avatar]));
export function resolvePlayerAvatar(id?: string | null) {
  return avatarsById.get(id ?? DEFAULT_PLAYER_AVATAR_ID) ?? avatarsById.get(DEFAULT_PLAYER_AVATAR_ID)!;
}
export function normalizePlayerAvatarId(id?: string | null) {
  return resolvePlayerAvatar(id).id;
}

export function getPlayerAvatarFrame(avatarId: string | undefined, direction: PlayerMovementDirection, moving: boolean, animationFrame: number) {
  if (resolvePlayerAvatar(avatarId).id === DEFAULT_PLAYER_AVATAR_ID) return moving ? animationFrame : 0;
  return PLAYER_DIRECTION_ROWS[direction] * 4 + (moving ? animationFrame % 4 : 0);
}
