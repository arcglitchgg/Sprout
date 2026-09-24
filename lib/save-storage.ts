import { FIRST_WORLD } from "@/lib/world-data";
import { TOTAL_FARM_PLOTS } from "@/lib/progression";
import { getLevelFromXp } from "@/lib/fighter-progression";
import type { CropType, HarvestMutationType, MutationType, PersonalityType, Plot } from "@/lib/game-types";
import type { SproutSaveV1, SproutSaveV2, SproutSaveV3 } from "@/lib/save-types";

export const SAVE_KEY = "sprout.save";
export const discordSaveKey = (userId: string) => `sprout.save.${userId}`;
export const CURRENT_SAVE_VERSION = 3;

export type SaveLoadResult =
  | { status: "empty" | "invalid" | "future"; save: null }
  | { status: "loaded"; save: SproutSaveV3 };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const crops: CropType[] = ["potato", "carrot", "corn"];
const harvestMutations: HarvestMutationType[] = ["normal", "large", "golden", "prismatic"];
const fighterMutations: MutationType[] = [...harvestMutations, "ascended"];
const personalities: PersonalityType[] = ["angry", "protective", "lazy", "clever", "mean"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isCrop = (value: unknown): value is CropType => crops.includes(value as CropType);
const isHarvestMutation = (value: unknown): value is HarvestMutationType => harvestMutations.includes(value as HarvestMutationType);
const isFighterMutation = (value: unknown): value is MutationType => fighterMutations.includes(value as MutationType);
const isPersonality = (value: unknown): value is PersonalityType => personalities.includes(value as PersonalityType);
const validAscensionPity = (value: unknown) => isRecord(value) && crops.every((crop) =>
  Number.isInteger(value[crop]) && (value[crop] as number) >= 0 && (value[crop] as number) < 3);
const validDungeonProgress = (value: unknown) => {
  if (!isRecord(value) || !Number.isInteger(value.highestClearedFloor) || (value.highestClearedFloor as number) < 0 || (value.highestClearedFloor as number) > 20) return false;
  if (value.floor20FirstClear === undefined) return true;
  if (!isRecord(value.floor20FirstClear) || !isFiniteNonnegative(value.floor20FirstClear.clearedAt) || !Array.isArray(value.floor20FirstClear.team) || value.floor20FirstClear.team.length !== 3) return false;
  return value.floor20FirstClear.team.every((fighter) => isRecord(fighter) && isCrop(fighter.crop) && isFighterMutation(fighter.mutation) && Number.isSafeInteger(fighter.level) && (fighter.level as number) >= 1);
};

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

function validSharedSave(value: Record<string, unknown>, plotCount: number, requireFarmXp: boolean, requireFighterProgression = false) {
  if (!isFiniteNonnegative(value.savedAt) || !isRecord(value.game) || !isRecord(value.world)) return false;
  const game = value.game;
  if (!isFiniteNonnegative(game.coins) || !isCrop(game.selectedCrop) || !isRecord(game.seeds)) return false;
  if (requireFarmXp && !isFiniteNonnegative(game.farmXp)) return false;
  if (requireFarmXp && game.ascensionPity !== undefined && !validAscensionPity(game.ascensionPity)) return false;
  if (requireFighterProgression && game.dungeon !== undefined && !validDungeonProgress(game.dungeon)) return false;
  const seeds = game.seeds;
  if (!crops.every((crop) => Number.isInteger(seeds[crop]) && (seeds[crop] as number) >= 0)) return false;
  if (!validPlots(game.plots, plotCount)) return false;

  if (!Array.isArray(game.harvestedCrops)) return false;
  const harvestedIds = new Set<string>();
  for (const item of game.harvestedCrops) {
    if (!isRecord(item) || !isId(item.id) || harvestedIds.has(item.id) || !isCrop(item.crop) || !isHarvestMutation(item.mutation) || !isFiniteNonnegative(item.baseSellValue) || !isFiniteNonnegative(item.sellValue) || !isFiniteNonnegative(item.harvestedAt)) return false;
    harvestedIds.add(item.id);
  }

  if (!Array.isArray(game.collection) || !game.collection.every((entry) => isRecord(entry) && isCrop(entry.crop) && isHarvestMutation(entry.mutation))) return false;
  if (!Array.isArray(game.fighters)) return false;
  const fighterIds = new Set<string>();
  for (const fighter of game.fighters) {
    if (!isRecord(fighter) || !isId(fighter.id) || fighterIds.has(fighter.id) || !isCrop(fighter.crop) || !isFighterMutation(fighter.mutation) || !isPersonality(fighter.personality)) return false;
    if (![fighter.hp, fighter.attack, fighter.defense, fighter.speed].every(isFiniteNonnegative)) return false;
    if (requireFighterProgression && (!Number.isSafeInteger(fighter.level) || (fighter.level as number) < 1 || !Number.isSafeInteger(fighter.xp) || (fighter.xp as number) < 0 || fighter.level !== getLevelFromXp(fighter.xp as number))) return false;
    fighterIds.add(fighter.id);
  }

  return validFarmerTile(value.world.farmerTile) && (value.world.facing === "left" || value.world.facing === "right");
}

export function validateSproutSaveV1(value: unknown): value is SproutSaveV1 {
  return isRecord(value) && value.version === 1 && validSharedSave(value, 9, false);
}

export function validateSproutSaveV2(value: unknown): value is SproutSaveV2 {
  return isRecord(value) && value.version === 2 && validSharedSave(value, TOTAL_FARM_PLOTS, true);
}

export function validateSproutSave(value: unknown): value is SproutSaveV3 {
  return isRecord(value) && value.version === 3 && validSharedSave(value, TOTAL_FARM_PLOTS, true, true);
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
  return validateSproutSaveV2(migrated) ? migrated : null;
}

export function migrateV2ToV3(value: unknown): SproutSaveV3 | null {
  if (!validateSproutSaveV2(value)) return null;
  const migrated: SproutSaveV3 = {
    version: 3,
    savedAt: value.savedAt,
    game: {
      ...value.game,
      seeds: { ...value.game.seeds },
      plots: value.game.plots.map((plot) => ({ ...plot })),
      harvestedCrops: value.game.harvestedCrops.map((item) => ({ ...item })),
      collection: value.game.collection.map((entry) => ({ ...entry })),
      fighters: value.game.fighters.map((fighter) => ({ ...fighter, level: 1, xp: 0 })),
      ascensionPity: value.game.ascensionPity ? { ...value.game.ascensionPity } : undefined,
      dungeon: { highestClearedFloor: 0 },
    },
    world: { farmerTile: { ...value.world.farmerTile }, facing: value.world.facing },
  };
  return validateSproutSave(migrated) ? migrated : null;
}

export function migrateSproutSave(value: unknown): SproutSaveV3 | null {
  if (validateSproutSave(value)) return value;
  if (!isRecord(value)) return null;
  if (value.version === 1) {
    const v2 = migrateV1ToV2(value);
    return v2 ? migrateV2ToV3(v2) : null;
  }
  if (value.version === 2) return migrateV2ToV3(value);
  return null;
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
    const migrated = migrateSproutSave(parsed);
    if (!migrated) {
      developmentWarning("Sprout save is invalid; starting with fresh progress.");
      return { status: "invalid", save: null };
    }
    return { status: "loaded", save: migrated };
  } catch (error) {
    developmentWarning("Sprout save could not be parsed; starting with fresh progress.", error);
    return { status: "invalid", save: null };
  }
}

export function writeSproutSave(save: SproutSaveV3, storage?: StorageLike, key = SAVE_KEY) {
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
