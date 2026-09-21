import { crops } from "@/lib/game-data";
import { getHarvestValue, isReady } from "@/lib/farming";
import type { CropType, HarvestedCrop, HarvestMutationType, Plot } from "@/lib/game-types";

export function createHarvestedCrop(
  crop: CropType,
  mutation: HarvestMutationType,
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
  mutation: HarvestMutationType,
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

/** Apply all eligible harvests to one snapshot; each crop gets its own roll and item. */
export function harvestReadyPlots(
  plots: Plot[], items: HarvestedCrop[], unlockedPlotCount: number, harvestedAt: number,
  roll: () => HarvestMutationType,
  createId: () => string = () => crypto.randomUUID(),
) {
  const harvested: HarvestedCrop[] = [];
  const nextPlots = plots.map((plot) => {
    if (plot.id >= unlockedPlotCount || !plot.crop || !isReady(plot, harvestedAt)) return plot;
    harvested.push(createHarvestedCrop(plot.crop, roll(), harvestedAt, createId()));
    return { ...plot, crop: null, plantedAt: null };
  });
  return { harvested, plots: harvested.length ? nextPlots : plots, items: harvested.length ? [...items, ...harvested] : items };
}
