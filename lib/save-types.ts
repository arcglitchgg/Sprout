import type { CollectionEntry, CropType, Fighter, HarvestedCrop, Plot, SeedInventory } from "@/lib/game-types";
import type { WorldPoint } from "@/lib/world-types";

type SproutGameSaveBase = {
  coins: number;
  seeds: SeedInventory;
  selectedCrop: CropType;
  plots: Plot[];
  harvestedCrops: HarvestedCrop[];
  collection: CollectionEntry[];
  fighters: Fighter[];
};

export type SproutGameSaveV1 = SproutGameSaveBase;
export type SproutGameSaveV2 = SproutGameSaveBase & { farmXp: number };
export type SproutWorldSave = { farmerTile: WorldPoint; facing: "left" | "right" };
export type SproutSaveV1 = { version: 1; savedAt: number; game: SproutGameSaveV1; world: SproutWorldSave };
export type SproutSaveV2 = { version: 2; savedAt: number; game: SproutGameSaveV2; world: SproutWorldSave };
export type SproutSavePayloadV2 = Omit<SproutSaveV2, "version" | "savedAt">;
