import { crops } from "@/lib/game-data";
import { getHarvestValue, isReady } from "@/lib/farming";
import type { CropType, HarvestedCrop, MutationType, Plot } from "@/lib/game-types";

export function createHarvestedCrop(
  crop: CropType,
  mutation: MutationType,
  harvestedAt: number,
  id = crypto.randomUUID(),
): HarvestedCrop {
  return {
    id,
    crop,
    mutation,
    baseSellValue: crops[crop].sellPrice,
    sellValue: getHarvestValue(crop, mutation),
    harvestedAt,
  };
}

export function removeHarvestedCrop(items: HarvestedCrop[], itemId: string) {
  const item = items.find((entry) => entry.id === itemId) ?? null;
  return {
    item,
    remaining: item ? items.filter((entry) => entry.id !== itemId) : items,
  };
}

export function sellHarvestedCrop(items: HarvestedCrop[], coins: number, itemId: string) {
  const result = removeHarvestedCrop(items, itemId);
  return {
    ...result,
    coins: result.item ? coins + result.item.sellValue : coins,
  };
}

export function sellHarvestedCrops(items: HarvestedCrop[], coins: number, itemIds: string[]) {
  const selectedIds = new Set(itemIds);
  const sold = items.filter((item) => selectedIds.has(item.id));
  const total = sold.reduce((sum, item) => sum + item.sellValue, 0);

  return {
    sold,
    remaining: sold.length ? items.filter((item) => !selectedIds.has(item.id)) : items,
    total,
    coins: coins + total,
  };
}

export function harvestPlot(
  plots: Plot[],
  items: HarvestedCrop[],
  plotId: number,
  mutation: MutationType,
  harvestedAt: number,
  itemId?: string,
) {
  const plot = plots.find((entry) => entry.id === plotId);
  if (!plot?.crop || !isReady(plot, harvestedAt)) return null;

  const item = createHarvestedCrop(plot.crop, mutation, harvestedAt, itemId);
  return {
    item,
    plots: plots.map((entry) => entry.id === plotId ? { ...entry, crop: null, plantedAt: null } : entry),
    items: [...items, item],
  };
}
