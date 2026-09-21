import { crops } from "@/lib/game-data";
import type { CropType, Plot, SeedInventory } from "@/lib/game-types";

export const INITIAL_SEEDS: SeedInventory = {
  potato: 3,
  carrot: 0,
  corn: 0,
};

export function purchaseSeed(seeds: SeedInventory, coins: number, crop: CropType, quantity = 1) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { purchased: false, seeds, coins, quantity: 0, totalPrice: 0 };
  const totalPrice = crops[crop].cost * quantity;
  if (coins < totalPrice) return { purchased: false, seeds, coins, quantity, totalPrice };
  return {
    purchased: true,
    seeds: { ...seeds, [crop]: seeds[crop] + quantity },
    coins: coins - totalPrice,
    quantity,
    totalPrice,
  };
}

export function plantWithSeed(
  plots: Plot[],
  seeds: SeedInventory,
  plotId: number,
  crop: CropType,
  plantedAt: number,
  unlockedPlotCount = plots.length,
) {
  const plot = plots.find((entry) => entry.id === plotId);
  if (!plot || plotId < 0 || plotId >= unlockedPlotCount || plot.crop !== null || seeds[crop] < 1) {
    return { planted: false, plots, seeds };
  }
  return {
    planted: true,
    plots: plots.map((entry) => entry.id === plotId ? { ...entry, crop, plantedAt } : entry),
    seeds: { ...seeds, [crop]: seeds[crop] - 1 },
  };
}
