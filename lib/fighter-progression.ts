import type { Fighter } from "@/lib/game-types";

export const FIGHTER_STAT_BONUS_PER_LEVEL = 0.03;

export function getXpRequiredForNextLevel(currentLevel: number) {
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 1) throw new Error("Fighter level must be a positive integer.");
  return 50 + 30 * (currentLevel - 1);
}

export function getLevelFromXp(xp: number) {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new Error("Fighter XP must be a nonnegative integer.");
  const completedLevels = Math.floor((-35 + Math.sqrt(1225 + 60 * xp)) / 30);
  return completedLevels + 1;
}

export function awardFighterXp(fighter: Fighter, amount: number): Fighter {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Fighter XP award must be a nonnegative integer.");
  const xp = fighter.xp + amount;
  if (!Number.isSafeInteger(xp)) throw new Error("Fighter XP exceeds the supported range.");
  return { ...fighter, xp, level: getLevelFromXp(xp) };
}

export function getFighterLevelMultiplier(level: number) {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error("Fighter level must be a positive integer.");
  return Math.round((1 + FIGHTER_STAT_BONUS_PER_LEVEL * (level - 1)) * 100) / 100;
}

export function getEffectiveFighter(fighter: Fighter): Fighter {
  // Runtime defaults keep already-created PvP/defense snapshots from before Save V3 replayable.
  const level = Number.isSafeInteger(fighter.level) && fighter.level >= 1 ? fighter.level : 1;
  const xp = Number.isSafeInteger(fighter.xp) && fighter.xp >= 0 ? fighter.xp : 0;
  const multiplier = getFighterLevelMultiplier(level);
  return {
    ...fighter,
    level,
    xp,
    hp: Math.round(fighter.hp * multiplier),
    attack: Math.round(fighter.attack * multiplier),
    defense: Math.round(fighter.defense * multiplier),
    speed: Math.round(fighter.speed * multiplier),
  };
}
