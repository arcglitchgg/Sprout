import type { CropType, Fighter } from "@/lib/game-types";

export const FIGHTER_STAT_BONUS_PER_LEVEL = 0.03;
export type FighterCombatStat = "hp" | "attack" | "defense" | "speed";
export const FIGHTER_GROWTH_CEILINGS: Record<CropType, Record<FighterCombatStat, number>> = {
  potato: { hp: 2.5, attack: 1.7, defense: 2.4, speed: 1.5 },
  carrot: { hp: 1.8, attack: 2, defense: 1.7, speed: 2.5 },
  corn: { hp: 1.8, attack: 2.5, defense: 1.7, speed: 1.75 },
};
export const MAX_EFFECTIVE_BATTLE_SPEED = 100;

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

export function getFighterStatMultiplier(crop: CropType, stat: FighterCombatStat, level: number, storedStat: number) {
  if (!Number.isSafeInteger(level) || level < 1) throw new Error("Fighter level must be a positive integer.");
  const configuredCeiling = FIGHTER_GROWTH_CEILINGS[crop][stat];
  const ceiling = stat === "speed" && storedStat > 0
    ? Math.max(1, Math.min(configuredCeiling, MAX_EFFECTIVE_BATTLE_SPEED / storedStat))
    : configuredCeiling;
  if (ceiling === 1 || level === 1) return 1;
  return ceiling - (ceiling - 1) * Math.exp(-FIGHTER_STAT_BONUS_PER_LEVEL * (level - 1) / (ceiling - 1));
}

export function getEffectiveFighter(fighter: Fighter): Fighter {
  // Runtime defaults keep already-created PvP/defense snapshots from before Save V3 replayable.
  const level = Number.isSafeInteger(fighter.level) && fighter.level >= 1 ? fighter.level : 1;
  const xp = Number.isSafeInteger(fighter.xp) && fighter.xp >= 0 ? fighter.xp : 0;
  const scale = (stat: FighterCombatStat) => Math.round(fighter[stat] * getFighterStatMultiplier(fighter.crop, stat, level, fighter[stat]));
  return {
    ...fighter,
    level,
    xp,
    hp: scale("hp"),
    attack: scale("attack"),
    defense: scale("defense"),
    speed: scale("speed"),
  };
}
