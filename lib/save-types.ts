import type { CollectionEntry, CropType, Fighter, HarvestedCrop, Plot, SeedInventory } from "@/lib/game-types";
import type { WorldPoint } from "@/lib/world-types";

export type SproutGameSaveV1 = {
  coins: number;
  seeds: SeedInventory;
  selectedCrop: CropType;
  plots: Plot[];
  harvestedCrops: HarvestedCrop[];
  collection: CollectionEntry[];
  fighters: Fighter[];
};

export type SproutWorldSaveV1 = {
  farmerTile: WorldPoint;
  facing: "left" | "right";
};

export type SproutSaveV1 = {
  version: 1;
  savedAt: number;
  game: SproutGameSaveV1;
  world: SproutWorldSaveV1;
};

export type SproutSavePayloadV1 = Omit<SproutSaveV1, "version" | "savedAt">;
