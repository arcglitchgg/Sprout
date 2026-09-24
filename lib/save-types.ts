import type { AscensionPity, CollectionEntry, CropType, Fighter, HarvestedCrop, LegacyFighter, Plot, SeedInventory } from "@/lib/game-types";
import type { WorldPoint } from "@/lib/world-types";

type SproutGameSaveBase<TFighter> = {
  coins: number;
  seeds: SeedInventory;
  selectedCrop: CropType;
  plots: Plot[];
  harvestedCrops: HarvestedCrop[];
  collection: CollectionEntry[];
  fighters: TFighter[];
};

export type SproutGameSaveV1 = SproutGameSaveBase<LegacyFighter>;
export type SproutGameSaveV2 = SproutGameSaveBase<LegacyFighter> & { farmXp: number; ascensionPity?: AscensionPity };
export type SproutGameSaveV3 = SproutGameSaveBase<Fighter> & { farmXp: number; ascensionPity?: AscensionPity };
export type SproutWorldSave = { farmerTile: WorldPoint; facing: "left" | "right" };
export type SproutSaveV1 = { version: 1; savedAt: number; game: SproutGameSaveV1; world: SproutWorldSave };
export type SproutSaveV2 = { version: 2; savedAt: number; game: SproutGameSaveV2; world: SproutWorldSave };
export type SproutSaveV3 = { version: 3; savedAt: number; game: SproutGameSaveV3; world: SproutWorldSave };
export type SproutSavePayloadV3 = Omit<SproutSaveV3, "version" | "savedAt">;
