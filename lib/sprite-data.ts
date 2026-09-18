import type { CropType } from "@/lib/game-types";

export type SpriteSheet = { src: string; width: number; height: number; frameWidth: number; frameHeight: number };
export type SpriteRegion = { x: number; y: number; width: number; height: number };

const assetRoot = "/assets/Pixel Farm_Assets/Pixel Farm_Assets";

export const WORLD_SPRITE_SHEETS = {
  tiles: { src: `${assetRoot}/PixelFarm_Tileset.png`, width: 224, height: 176, frameWidth: 16, frameHeight: 16 },
  farmer: { src: `${assetRoot}/PixelFarm_Farmer-Sheet.png`, width: 128, height: 96, frameWidth: 32, frameHeight: 32 },
  crops: { src: `${assetRoot}/PixelFarm_Crops.png`, width: 96, height: 96, frameWidth: 16, frameHeight: 16 },
} satisfies Record<string, SpriteSheet>;

export const WORLD_TILE_REGIONS = {
  grass: { x: 0, y: 16, width: 16, height: 16 },
  "grass-tuft": { x: 16, y: 16, width: 16, height: 16 },
  path: { x: 128, y: 48, width: 16, height: 16 },
  soil: { x: 112, y: 48, width: 16, height: 16 },
  "fence-horizontal": { x: 96, y: 16, width: 16, height: 16 },
  "fence-vertical": { x: 80, y: 32, width: 16, height: 16 },
  "fence-corner": { x: 80, y: 16, width: 16, height: 16 },
  "tree-round": { x: 0, y: 112, width: 48, height: 48 },
  "tree-pine": { x: 32, y: 96, width: 64, height: 64 },
} satisfies Record<string, SpriteRegion>;

export const FARMER_ANIMATION = {
  idleFrame: 0,
  walkFrames: [4, 5, 6, 7, 8, 9],
  frameMs: 120,
};

export const WORLD_CROP_SPRITES: Record<CropType, { early: SpriteRegion; growing: SpriteRegion; ready: SpriteRegion }> = {
  potato: {
    early: { x: 32, y: 32, width: 16, height: 16 },
    growing: { x: 48, y: 32, width: 16, height: 16 },
    ready: { x: 64, y: 32, width: 16, height: 16 },
  },
  carrot: {
    early: { x: 32, y: 16, width: 16, height: 16 },
    growing: { x: 48, y: 16, width: 16, height: 16 },
    ready: { x: 64, y: 16, width: 16, height: 16 },
  },
  corn: {
    early: { x: 32, y: 64, width: 16, height: 16 },
    growing: { x: 48, y: 64, width: 16, height: 16 },
    ready: { x: 64, y: 64, width: 16, height: 16 },
  },
};

// Temporary mature-plant frames from the 96x96 Pixel Farm sheet (16px cells).
// Keep frame coordinates centralized until dedicated battle forms are available.
const sheet = `${assetRoot}/PixelFarm_Crops.png`;
export const BATTLE_SPRITES: Record<CropType, { src: string; x: number; y: number }> = {
  potato: { src: sheet, x: 80, y: 16 },
  carrot: { src: sheet, x: 80, y: 64 },
  corn: { src: sheet, x: 80, y: 80 },
};
