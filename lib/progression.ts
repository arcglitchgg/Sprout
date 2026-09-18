import type { BattleState } from "@/lib/battle-types";

export const FARM_XP_REWARDS = { plant: 2, harvest: 5, sell: 2, awaken: 10, dungeonVictory: 15 } as const;
export const FARM_LEVEL_THRESHOLDS = [0, 40, 100, 180, 300, 450, 650, 900, 1200, 1600] as const;
export const FARM_LEVEL_PLOT_COUNTS = [9, 18, 27, 36, 54, 72, 90, 108, 126, 144] as const;
export const MAX_FARM_LEVEL = 10;
export const TOTAL_FARM_PLOTS = 144;

export function getFarmLevel(farmXp: number) {
  let level = 1;
  for (let index = 1; index < FARM_LEVEL_THRESHOLDS.length; index += 1) {
    if (farmXp < FARM_LEVEL_THRESHOLDS[index]) break;
    level = index + 1;
  }
  return Math.min(level, MAX_FARM_LEVEL);
}

export function getUnlockedPlotCount(farmXp: number) {
  return FARM_LEVEL_PLOT_COUNTS[getFarmLevel(farmXp) - 1];
}

export function getCrossedLevels(previousXp: number, nextXp: number) {
  const previousLevel = getFarmLevel(previousXp);
  const nextLevel = getFarmLevel(nextXp);
  return Array.from({ length: Math.max(0, nextLevel - previousLevel) }, (_, index) => previousLevel + index + 1);
}

export function getPlotUnlockLevel(plotId: number) {
  const index = FARM_LEVEL_PLOT_COUNTS.findIndex((count) => plotId < count);
  return index < 0 ? MAX_FARM_LEVEL : index + 1;
}

export function claimBattleVictoryReward(rewardedBattleIds: Set<string>, result: Pick<BattleState, "id" | "status">) {
  if (result.status !== "victory" || rewardedBattleIds.has(result.id)) return false;
  rewardedBattleIds.add(result.id);
  return true;
}
