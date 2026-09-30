import type { CropType, Fighter, MutationType } from "@/lib/game-types";

export const FUSION_RARITIES: MutationType[] = ["normal", "large", "golden", "prismatic", "ascended"];
export const FUSION_SPECIES: CropType[] = ["potato", "carrot", "corn"];

export type FusionRosterGroup = {
  mutation: MutationType;
  crop: CropType;
  fighters: Fighter[];
  ownedCount: number;
  eligibleCount: number;
  fusionCount: number;
};

export function getFusionRosterGroups(fighters: Fighter[]): FusionRosterGroup[] {
  return FUSION_RARITIES.flatMap((mutation) => FUSION_SPECIES.map((crop) => {
    const grouped = fighters.filter((fighter) => fighter.mutation === mutation && fighter.crop === crop);
    const eligibleCount = mutation === "ascended" ? 0 : grouped.filter((fighter) => !fighter.locked).length;
    return { mutation, crop, fighters: grouped, ownedCount: grouped.length, eligibleCount, fusionCount: Math.floor(eligibleCount / 4) };
  }));
}

export function setRosterFighterLocked(fighters: Fighter[], fighterId: string, locked: boolean) {
  const index = fighters.findIndex((fighter) => fighter.id === fighterId);
  if (index < 0 || fighters[index].locked === locked) return null;
  return fighters.map((fighter, fighterIndex) => fighterIndex === index ? { ...fighter, locked } : fighter);
}

export function releaseRosterFighter(fighters: Fighter[], fighterId: string) {
  const fighter = fighters.find((entry) => entry.id === fighterId);
  if (!fighter || fighter.locked) return null;
  return { released: fighter, remaining: fighters.filter((entry) => entry.id !== fighterId) };
}

export function getReleaseConfirmationCount(mutation: MutationType) {
  return mutation === "prismatic" || mutation === "ascended" ? 2 : 1;
}
