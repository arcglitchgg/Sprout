import { FIGHTER_RARITY_MULTIPLIERS, personalities } from "@/lib/game-data";
import type { CropType, Fighter, FighterNaturalStats, MutationType, PersonalityType } from "@/lib/game-types";

export type FighterStat = keyof FighterNaturalStats;
type StatRange = { min: number; max: number };

export const FIGHTER_SPECIES_BASE_STATS: Record<CropType, Record<FighterStat, number>> = {
  potato: { hp: 170, attack: 20, defense: 30, speed: 20 },
  carrot: { hp: 125, attack: 25, defense: 20, speed: 35 },
  corn: { hp: 125, attack: 35, defense: 20, speed: 20 },
};

export const FIGHTER_NATURAL_STAT_RANGES: Record<CropType, Record<FighterStat, StatRange>> = {
  potato: { hp: { min: 155, max: 185 }, attack: { min: 19, max: 21 }, defense: { min: 26, max: 34 }, speed: { min: 19, max: 21 } },
  carrot: { hp: { min: 120, max: 130 }, attack: { min: 23, max: 28 }, defense: { min: 19, max: 21 }, speed: { min: 31, max: 39 } },
  corn: { hp: { min: 120, max: 130 }, attack: { min: 31, max: 39 }, defense: { min: 19, max: 21 }, speed: { min: 19, max: 22 } },
};

export function isPerfectNaturalStat(fighter: Pick<Fighter, "crop" | "naturalStats">, stat: FighterStat) {
  return fighter.naturalStats?.[stat] === FIGHTER_NATURAL_STAT_RANGES[fighter.crop][stat].max;
}

export function getNaturalStatDisplayState(fighter: Pick<Fighter, "crop" | "naturalStats">, stat: FighterStat) {
  return isPerfectNaturalStat(fighter, stat) ? "prismatic" as const : "normal" as const;
}

function rollStat(range: StatRange, random: () => number) {
  return range.min + Math.floor(random() * (range.max - range.min + 1));
}

export function generateFighter(source: { crop: CropType; mutation: MutationType }, random: () => number = Math.random): Fighter {
  const ranges = FIGHTER_NATURAL_STAT_RANGES[source.crop];
  const naturalStats: FighterNaturalStats = {
    hp: rollStat(ranges.hp, random),
    attack: rollStat(ranges.attack, random),
    defense: rollStat(ranges.defense, random),
    speed: rollStat(ranges.speed, random),
  };
  let { hp, attack, defense, speed } = naturalStats;

  const personalityKeys = Object.keys(
    personalities
  ) as PersonalityType[];

  const personality =
    personalityKeys[
    Math.floor(random() * personalityKeys.length)
    ];

  // Mutation strength
  const mutationMultiplier = FIGHTER_RARITY_MULTIPLIERS[source.mutation];

  hp = Math.round(hp * mutationMultiplier);
  attack = Math.round(attack * mutationMultiplier);
  defense = Math.round(defense * mutationMultiplier);
  speed = Math.round(speed * mutationMultiplier);

  // Personality stat effects
  if (personality === "angry") {
    attack = Math.round(attack * 1.15);
    defense = Math.round(defense * 0.9);
  }

  if (personality === "protective") {
    defense = Math.round(defense * 1.15);
  }

  if (personality === "lazy") {
    attack = Math.round(attack * 1.25);
    speed = Math.round(speed * 0.85);
  }

  const fighter: Fighter = {
    id: crypto.randomUUID(),
    crop: source.crop,
    mutation: source.mutation,
    personality,
    hp,
    attack,
    defense,
    speed,
    naturalStats,
    level: 1,
    xp: 0,
    locked: false,
    favorite: false,
  };

  return fighter;
}
