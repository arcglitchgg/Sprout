import { FIRST_WORLD } from "@/lib/world-data";
import { TOTAL_FARM_PLOTS } from "@/lib/progression";
import type { CropType, MutationType, PersonalityType, Plot } from "@/lib/game-types";
import type { SproutSaveV1, SproutSaveV2 } from "@/lib/save-types";

export const SAVE_KEY = "sprout.save";
export const discordSaveKey = (userId: string) => `sprout.save.${userId}`;
export const CURRENT_SAVE_VERSION = 2;

export type SaveLoadResult =
  | { status: "empty" | "invalid" | "future"; save: null }
  | { status: "loaded"; save: SproutSaveV2 };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const crops: CropType[] = ["potato", "carrot", "corn"];
const mutations: MutationType[] = ["normal", "large", "golden", "prismatic"];
const personalities: PersonalityType[] = ["angry", "protective", "lazy", "clever", "mean"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isCrop = (value: unknown): value is CropType => crops.includes(value as CropType);
const isMutation = (value: unknown): value is MutationType => mutations.includes(value as MutationType);
const isPersonality = (value: unknown): value is PersonalityType => personalities.includes(value as PersonalityType);

function validFarmerTile(value: unknown) {
  if (!isRecord(value) || !Number.isInteger(value.x) || !Number.isInteger(value.y)) return false;
  const x = value.x as number;
  const y = value.y as number;
  return x >= 0 && y >= 0 && x < FIRST_WORLD.width && y < FIRST_WORLD.height && !FIRST_WORLD.blocked[y * FIRST_WORLD.width + x];
}

function validPlots(value: unknown, expectedCount: number) {
  if (!Array.isArray(value) || value.length !== expectedCount) return false;
  const ids = new Set<number>();
  for (const plot of value) {
    if (!isRecord(plot) || !Number.isInteger(plot.id) || (plot.id as number) < 0 || (plot.id as number) >= expectedCount || ids.has(plot.id as number)) return false;
    ids.add(plot.id as number);
    if (plot.crop === null) {
      if (plot.plantedAt !== null) return false;
    } else if (!isCrop(plot.crop) || !isFiniteNonnegative(plot.plantedAt)) return false;
  }
  return true;
}

function validSharedSave(value: Record<string, unknown>, plotCount: number, requireFarmXp: boolean) {
  if (!isFiniteNonnegative(value.savedAt) || !isRecord(value.game) || !isRecord(value.world)) return false;
  const game = value.game;
  if (!isFiniteNonnegative(game.coins) || !isCrop(game.selectedCrop) || !isRecord(game.seeds)) return false;
  if (requireFarmXp && !isFiniteNonnegative(game.farmXp)) return false;
  const seeds = game.seeds;
  if (!crops.every((crop) => Number.isInteger(seeds[crop]) && (seeds[crop] as number) >= 0)) return false;
  if (!validPlots(game.plots, plotCount)) return false;

  if (!Array.isArray(game.harvestedCrops)) return false;
  const harvestedIds = new Set<string>();
  for (const item of game.harvestedCrops) {
    if (!isRecord(item) || !isId(item.id) || harvestedIds.has(item.id) || !isCrop(item.crop) || !isMutation(item.mutation) || !isFiniteNonnegative(item.baseSellValue) || !isFiniteNonnegative(item.sellValue) || !isFiniteNonnegative(item.harvestedAt)) return false;
    harvestedIds.add(item.id);
  }

  if (!Array.isArray(game.collection) || !game.collection.every((entry) => isRecord(entry) && isCrop(entry.crop) && isMutation(entry.mutation))) return false;
  if (!Array.isArray(game.fighters)) return false;
  const fighterIds = new Set<string>();
  for (const fighter of game.fighters) {
    if (!isRecord(fighter) || !isId(fighter.id) || fighterIds.has(fighter.id) || !isCrop(fighter.crop) || !isMutation(fighter.mutation) || !isPersonality(fighter.personality)) return false;
    if (![fighter.hp, fighter.attack, fighter.defense, fighter.speed].every(isFiniteNonnegative)) return false;
    fighterIds.add(fighter.id);
  }

  return validFarmerTile(value.world.farmerTile) && (value.world.facing === "left" || value.world.facing === "right");
}

export function validateSproutSaveV1(value: unknown): value is SproutSaveV1 {
  return isRecord(value) && value.version === 1 && validSharedSave(value, 9, false);
}

export function validateSproutSave(value: unknown): value is SproutSaveV2 {
  return isRecord(value) && value.version === 2 && validSharedSave(value, TOTAL_FARM_PLOTS, true);
}

export function migrateV1ToV2(value: unknown): SproutSaveV2 | null {
  if (!validateSproutSaveV1(value)) return null;
  const plots: Plot[] = [
    ...value.game.plots.map((plot) => ({ ...plot })),
    ...Array.from({ length: TOTAL_FARM_PLOTS - 9 }, (_, index) => ({ id: index + 9, crop: null, plantedAt: null })),
  ];
  const migrated: SproutSaveV2 = {
    version: 2,
    savedAt: value.savedAt,
    game: {
      coins: value.game.coins,
      farmXp: 0,
      seeds: { ...value.game.seeds },
      selectedCrop: value.game.selectedCrop,
      plots,
      harvestedCrops: value.game.harvestedCrops.map((item) => ({ ...item })),
      collection: value.game.collection.map((entry) => ({ ...entry })),
      fighters: value.game.fighters.map((fighter) => ({ ...fighter })),
    },
    world: { farmerTile: { ...value.world.farmerTile }, facing: value.world.facing },
  };
  return validateSproutSave(migrated) ? migrated : null;
}

function migrateSupportedSave(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.version === 1) return migrateV1ToV2(value);
  return value;
}

function developmentWarning(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== "production") console.warn(message, error ?? "");
}

export function loadSproutSave(storage?: StorageLike, key = SAVE_KEY): SaveLoadResult {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return { status: "empty", save: null };
  const raw = target.getItem(key);
  if (raw === null) return { status: "empty", save: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.version === "number" && parsed.version > CURRENT_SAVE_VERSION) {
      developmentWarning("Sprout save is from a newer version and will not be overwritten.");
      return { status: "future", save: null };
    }
    const migrated = migrateSupportedSave(parsed);
    if (!validateSproutSave(migrated)) {
      developmentWarning("Sprout save is invalid; starting with fresh progress.");
      return { status: "invalid", save: null };
    }
    return { status: "loaded", save: migrated };
  } catch (error) {
    developmentWarning("Sprout save could not be parsed; starting with fresh progress.", error);
    return { status: "invalid", save: null };
  }
}

export function writeSproutSave(save: SproutSaveV2, storage?: StorageLike, key = SAVE_KEY) {
  if (!validateSproutSave(save)) return false;
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return false;
  try {
    target.setItem(key, JSON.stringify(save));
    return true;
  } catch (error) {
    developmentWarning("Sprout progress could not be saved.", error);
    return false;
  }
}

export function deleteSproutSave(storage?: StorageLike) {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  target?.removeItem(SAVE_KEY);
}
