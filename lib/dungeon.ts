import { TRAINING_TEAM } from "@/lib/battle-data";
import { awardFighterXp } from "@/lib/fighter-progression";
import type { BattleState } from "@/lib/battle-types";
import type { CropType, Fighter, PersonalityType } from "@/lib/game-types";
import type { DungeonProgress } from "@/lib/save-types";

export const MAX_DUNGEON_FLOOR = 20;
export const INITIAL_DUNGEON_PROGRESS: DungeonProgress = { highestClearedFloor: 0 };
export const DUNGEON_BOSS_FLOORS = [5, 10, 15, 20] as const;
export const DUNGEON_BOSS_XP: Record<number, number> = { 5: 40, 10: 60, 15: 80, 20: 100 };
export const DUNGEON_ENEMY_MULTIPLIERS = [
  0.8, 1.05, 1.35, 1.73, 3,
  1.85, 1.98, 2.12, 2.28, 2.65,
  2.4, 2.55, 2.7, 2.88, 3,
  3.05, 3.25, 3.45, 3.7, 7,
] as const;

const BOSS_COUNTS: Record<number, number> = { 5: 1, 10: 2, 15: 3, 20: 1 };

export type DungeonXpGain = { fighterId: string; crop: CropType; personality: PersonalityType; xp: number; previousLevel: number; nextLevel: number };
export type DungeonVictoryReward = { floor: number; xpPerFighter: number; gains: DungeonXpGain[]; newlyCleared: boolean };

export function isDungeonBossFloor(floor: number) {
  return DUNGEON_BOSS_FLOORS.includes(floor as (typeof DUNGEON_BOSS_FLOORS)[number]);
}

export function getHighestUnlockedDungeonFloor(progress: DungeonProgress) {
  return Math.min(MAX_DUNGEON_FLOOR, progress.highestClearedFloor + 1);
}

export function isDungeonFloorUnlocked(floor: number, progress: DungeonProgress) {
  return Number.isInteger(floor) && floor >= 1 && floor <= getHighestUnlockedDungeonFloor(progress);
}

export function getDungeonFloorXp(floor: number) {
  if (!Number.isInteger(floor) || floor < 1 || floor > MAX_DUNGEON_FLOOR) throw new Error("Invalid dungeon floor.");
  return DUNGEON_BOSS_XP[floor] ?? 8 + floor * 2;
}

export function createDungeonEnemyTeam(floor: number): Fighter[] {
  if (!Number.isInteger(floor) || floor < 1 || floor > MAX_DUNGEON_FLOOR) throw new Error("Invalid dungeon floor.");
  const boss = isDungeonBossFloor(floor);
  const count = boss ? BOSS_COUNTS[floor] : 3;
  const multiplier = DUNGEON_ENEMY_MULTIPLIERS[floor - 1];
  return Array.from({ length: count }, (_, index) => {
    const base = TRAINING_TEAM[index % TRAINING_TEAM.length];
    return {
      ...base,
      id: `dungeon-floor-${floor}-enemy-${index}`,
      hp: Math.round(base.hp * multiplier),
      attack: Math.round(base.attack * multiplier),
      defense: Math.round(base.defense * multiplier),
      speed: Math.round(base.speed * Math.min(multiplier, 1.65)),
      visualScale: boss ? floor === 20 ? 2.2 : 1.8 : 1,
    };
  });
}

export function applyDungeonVictory(
  fighters: Fighter[], progress: DungeonProgress, result: BattleState, floor: number,
  rewardedBattleIds: Set<string>, clearedAt = Date.now(),
): { fighters: Fighter[]; progress: DungeonProgress; reward: DungeonVictoryReward } | null {
  if (result.mode !== "dungeon" || result.status !== "victory" || rewardedBattleIds.has(result.id) || !isDungeonFloorUnlocked(floor, progress)) return null;
  const participantIds = result.combatants.filter((fighter) => fighter.side === "player").map((fighter) => fighter.id);
  if (participantIds.length !== 3 || new Set(participantIds).size !== 3) return null;
  const participants = participantIds.map((id) => fighters.find((fighter) => fighter.id === id));
  if (participants.some((fighter) => !fighter)) return null;

  const xp = getDungeonFloorXp(floor);
  const gains: DungeonXpGain[] = [];
  const participantSet = new Set(participantIds);
  const nextFighters = fighters.map((fighter) => {
    if (!participantSet.has(fighter.id)) return fighter;
    const next = awardFighterXp(fighter, xp);
    gains.push({ fighterId: fighter.id, crop: fighter.crop, personality: fighter.personality, xp, previousLevel: fighter.level, nextLevel: next.level });
    return next;
  });
  const newlyCleared = floor > progress.highestClearedFloor;
  const nextProgress: DungeonProgress = { ...progress, highestClearedFloor: Math.max(progress.highestClearedFloor, floor) };
  if (floor === 20 && newlyCleared && !progress.floor20FirstClear) {
    nextProgress.floor20FirstClear = {
      clearedAt,
      team: participants.map((fighter) => ({ crop: fighter!.crop, mutation: fighter!.mutation, level: fighter!.level })),
    };
  }
  rewardedBattleIds.add(result.id);
  return { fighters: nextFighters, progress: nextProgress, reward: { floor, xpPerFighter: xp, gains, newlyCleared } };
}
