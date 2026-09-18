import { crops } from "@/lib/game-data";
import type { CropType, Plot, SeedInventory } from "@/lib/game-types";

export const INITIAL_SEEDS: SeedInventory = {
  potato: 3,
  carrot: 0,
  corn: 0,
};

export function purchaseSeed(seeds: SeedInventory, coins: number, crop: CropType) {
  const price = crops[crop].cost;
  if (coins < price) return { purchased: false, seeds, coins };
  return {
    purchased: true,
    seeds: { ...seeds, [crop]: seeds[crop] + 1 },
    coins: coins - price,
  };
}

export function plantWithSeed(
  plots: Plot[],
  seeds: SeedInventory,
  plotId: number,
  crop: CropType,
  plantedAt: number,
) {
  const plot = plots.find((entry) => entry.id === plotId);
  if (!plot || plot.crop !== null || seeds[crop] < 1) {
    return { planted: false, plots, seeds };
  }
  return {
    planted: true,
    plots: plots.map((entry) => entry.id === plotId ? { ...entry, crop, plantedAt } : entry),
    seeds: { ...seeds, [crop]: seeds[crop] - 1 },
  };
}
