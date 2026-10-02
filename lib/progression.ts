import type { BattleState } from "@/lib/battle-types";

export const FARM_XP_REWARDS = { plant: 2, harvest: 5, sell: 2, awaken: 10, dungeonVictory: 15 } as const;
export const FARM_LEVEL_THRESHOLDS = [0, 40, 100, 180, 300, 450, 650, 900, 1200, 1600] as const;
export const FARM_LEVEL_PLOT_COUNTS = [9, 18, 27, 36, 54, 72, 90, 108, 126, 144] as const;
export const MAX_FARM_UNLOCK_LEVEL = 10;
export const TOTAL_FARM_PLOTS = 144;

export function getFarmXpRequiredForNextLevel(level: number) {
  const normalizedLevel = Math.max(1, Math.floor(level));
  if (normalizedLevel < MAX_FARM_UNLOCK_LEVEL) return FARM_LEVEL_THRESHOLDS[normalizedLevel] - FARM_LEVEL_THRESHOLDS[normalizedLevel - 1];
  return 500 + 100 * (normalizedLevel - MAX_FARM_UNLOCK_LEVEL);
}

export function getCumulativeFarmXpForLevel(level: number) {
  const normalizedLevel = Math.max(1, Math.floor(level));
  if (normalizedLevel <= MAX_FARM_UNLOCK_LEVEL) return FARM_LEVEL_THRESHOLDS[normalizedLevel - 1];
  const prestigeLevels = normalizedLevel - MAX_FARM_UNLOCK_LEVEL;
  return FARM_LEVEL_THRESHOLDS[MAX_FARM_UNLOCK_LEVEL - 1] + 50 * prestigeLevels * prestigeLevels + 450 * prestigeLevels;
}

export function getFarmLevel(farmXp: number) {
  const totalXp = Math.max(0, Math.floor(farmXp));
  if (totalXp >= FARM_LEVEL_THRESHOLDS[MAX_FARM_UNLOCK_LEVEL - 1]) {
    const prestigeXp = totalXp - FARM_LEVEL_THRESHOLDS[MAX_FARM_UNLOCK_LEVEL - 1];
    let prestigeLevels = Math.floor((-450 + Math.sqrt(202_500 + 200 * prestigeXp)) / 100);
    while (getCumulativeFarmXpForLevel(MAX_FARM_UNLOCK_LEVEL + prestigeLevels + 1) <= totalXp) prestigeLevels += 1;
    while (prestigeLevels > 0 && getCumulativeFarmXpForLevel(MAX_FARM_UNLOCK_LEVEL + prestigeLevels) > totalXp) prestigeLevels -= 1;
    return MAX_FARM_UNLOCK_LEVEL + prestigeLevels;
  }
  let level = 1;
  for (let index = 1; index < FARM_LEVEL_THRESHOLDS.length; index += 1) {
    if (totalXp < FARM_LEVEL_THRESHOLDS[index]) break;
    level = index + 1;
  }
  return level;
}

export function getFarmLevelProgress(farmXp: number) {
  const totalXp = Math.max(0, Math.floor(farmXp));
  const level = getFarmLevel(totalXp);
  const current = totalXp - getCumulativeFarmXpForLevel(level);
  const required = getFarmXpRequiredForNextLevel(level);
  return { level, current, required, percent: Math.min(100, Math.max(0, (current / required) * 100)) };
}

export function getUnlockedPlotCount(farmXp: number) {
  return FARM_LEVEL_PLOT_COUNTS[Math.min(getFarmLevel(farmXp), MAX_FARM_UNLOCK_LEVEL) - 1];
}

export function getCrossedLevels(previousXp: number, nextXp: number) {
  const previousLevel = getFarmLevel(previousXp);
  const nextLevel = getFarmLevel(nextXp);
  return Array.from({ length: Math.max(0, nextLevel - previousLevel) }, (_, index) => previousLevel + index + 1);
}

export function getPlotUnlockLevel(plotId: number) {
  const index = FARM_LEVEL_PLOT_COUNTS.findIndex((count) => plotId < count);
  return index < 0 ? MAX_FARM_UNLOCK_LEVEL : index + 1;
}

export function claimBattleVictoryReward(rewardedBattleIds: Set<string>, result: Pick<BattleState, "id" | "status">) {
  if (result.status !== "victory" || rewardedBattleIds.has(result.id)) return false;
  rewardedBattleIds.add(result.id);
  return true;
}
