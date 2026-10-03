import manifest from "@/lib/fighter-sprite-manifest.json";
import type { CropType, MutationType, PersonalityType } from "@/lib/game-types";

export type BattleAnimationName = "idle" | "normal-attack" | "guard" | "skill";
export type FighterAssetAnimationName = "idle" | "normal_attack" | "defense" | "skill";
export type FighterSpriteFrame = { x: number; y: number; width: number; height: number; duration: number };
export type FighterSpriteDefinition = {
  src: string; sheetWidth: number; sheetHeight: number; frameWidth: number; frameHeight: number;
  facing: "left" | "right"; accessory: string | null;
  animations: Record<FighterAssetAnimationName, { loop: boolean; frames: FighterSpriteFrame[] }>;
};
export type BattleAnimation = {
  sprite: FighterSpriteDefinition;
  frames: FighterSpriteFrame[];
  frameDurationsMs: number[];
  loop: boolean;
};

export const BATTLE_TO_ASSET_ANIMATION: Record<BattleAnimationName, FighterAssetAnimationName> = {
  idle: "idle",
  "normal-attack": "normal_attack",
  guard: "defense",
  skill: "skill",
};

export const FIGHTER_SPRITE_REGISTRY = manifest as Record<string, FighterSpriteDefinition>;
const battleAnimationCache = new Map<string, BattleAnimation>();
export function resolveFighterSprite(fighter: { crop: CropType; mutation: MutationType; personality: PersonalityType }) {
  return FIGHTER_SPRITE_REGISTRY[`${fighter.crop}:${fighter.mutation}:${fighter.personality}`] ?? null;
}

export function getBattleAnimation(species: CropType, mutation: MutationType, personality: PersonalityType, name: BattleAnimationName): BattleAnimation | undefined {
  const cacheKey = `${species}:${mutation}:${personality}:${name}`;
  const cached = battleAnimationCache.get(cacheKey);
  if (cached) return cached;
  const sprite = resolveFighterSprite({ crop: species, mutation, personality });
  const animation = sprite?.animations[BATTLE_TO_ASSET_ANIMATION[name]];
  if (!sprite || !animation) return undefined;
  const resolved = { sprite, frames: animation.frames, frameDurationsMs: animation.frames.map((frame) => frame.duration), loop: animation.loop };
  battleAnimationCache.set(cacheKey, resolved);
  return resolved;
}
