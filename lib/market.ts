import type { HarvestedCrop } from "@/lib/game-types";

export function toggleMarketSelection(selectedIds: string[], itemId: string) {
  return selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];
}

export function selectAllMarketCrops(items: HarvestedCrop[]) {
  return items.map((item) => item.id);
}

export function selectNormalMarketCrops(items: HarvestedCrop[]) {
  return items.filter((item) => item.mutation === "normal").map((item) => item.id);
}

export function summarizeMarketSelection(items: HarvestedCrop[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  const selectedItems = items.filter((item) => selected.has(item.id));

  return {
    count: selectedItems.length,
    total: selectedItems.reduce((sum, item) => sum + item.sellValue, 0),
    requiresConfirmation: selectedItems.some((item) => item.mutation === "golden" || item.mutation === "prismatic"),
  };
}
