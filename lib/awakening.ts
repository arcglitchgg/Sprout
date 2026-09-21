import { generateFighter } from "@/lib/fighters";
import type { Fighter, HarvestedCrop, HarvestMutationType } from "@/lib/game-types";

export const AWAKENING_COSTS: Record<HarvestMutationType, number> = {
  normal: 20,
  large: 40,
  golden: 100,
  prismatic: 250,
};

export function awakenHarvestedCrop(
  items: HarvestedCrop[],
  fighters: Fighter[],
  coins: number,
  itemId: string,
  createFighter: (source: HarvestedCrop) => Fighter = generateFighter,
) {
  const item = items.find((entry) => entry.id === itemId);
  if (!item) return { awakened: false as const, reason: "missing" as const, items, fighters, coins };

  const cost = AWAKENING_COSTS[item.mutation];
  if (coins < cost) return { awakened: false as const, reason: "coins" as const, item, cost, items, fighters, coins };

  const fighter = createFighter(item);
  return {
    awakened: true as const,
    item,
    cost,
    fighter,
    items: items.filter((entry) => entry.id !== itemId),
    fighters: [...fighters, fighter],
    coins: coins - cost,
  };
}
