import type { Fighter } from "@/lib/game-types";

export function retainExistingTeamIds(selected: string[], fighters: Fighter[]): string[] {
  const available = new Set(fighters.map((fighter) => fighter.id));
  return selected.map((id) => available.has(id) ? id : "");
}
