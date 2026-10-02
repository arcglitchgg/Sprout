import { mutations } from "@/lib/game-data";
import type { CropType, HarvestedCrop, HarvestMutationType } from "@/lib/game-types";

export type MarketMutationFilter = "all" | HarvestMutationType;
export type MarketSpeciesFilter = "all" | CropType;
const MARKET_SPECIES_PLURALS: Record<CropType, string> = { potato: "Potatoes", carrot: "Carrots", corn: "Corn" };

export function toggleMarketSelection(selectedIds: string[], itemId: string) {
  return selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];
}

export function clearMarketSelection() {
  return [] as string[];
}

export function selectAllMarketCrops(items: HarvestedCrop[]) {
  return items.map((item) => item.id);
}

export function selectNormalMarketCrops(items: HarvestedCrop[]) {
  return items.filter((item) => item.mutation === "normal").map((item) => item.id);
}

export function filterMarketCrops(items: HarvestedCrop[], mutation: MarketMutationFilter, species: MarketSpeciesFilter) {
  return items.filter((item) => (mutation === "all" || item.mutation === mutation) && (species === "all" || item.crop === species));
}

export function selectVisibleMarketCrops(items: HarvestedCrop[], selectedIds: string[], mutation: MarketMutationFilter, species: MarketSpeciesFilter) {
  return [...new Set([...selectedIds, ...filterMarketCrops(items, mutation, species).map((item) => item.id)])];
}

export function getMarketSelectAllLabel(mutation: MarketMutationFilter, species: MarketSpeciesFilter) {
  const mutationName = mutation === "all" ? "" : mutations[mutation].name;
  const speciesName = species === "all" ? "" : MARKET_SPECIES_PLURALS[species];
  return `Select All${mutationName ? ` ${mutationName}` : ""}${speciesName ? ` ${speciesName}` : ""}`;
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
