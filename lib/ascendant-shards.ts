import type { Fighter, TeamPresets } from "@/lib/game-types";
import { clearMissingPresetIds } from "@/lib/team-selection";

export const ASCENDED_DISMANTLE_SHARDS = 1;
export const getDismantleConfirmationCount = (favorite: boolean | undefined) => favorite ? 2 : 1;

export function dismantleAscendedFighter(fighters: Fighter[], presets: TeamPresets, shards: number, fighterId: string) {
  const fighter = fighters.find((entry) => entry.id === fighterId);
  if (!fighter || fighter.mutation !== "ascended" || fighter.locked) return null;
  const remaining = fighters.filter((entry) => entry.id !== fighterId);
  return { fighter, remaining, presets: clearMissingPresetIds(presets, remaining), shards: shards + ASCENDED_DISMANTLE_SHARDS };
}
