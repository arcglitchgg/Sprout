import type { ActiveTeam, Fighter } from "@/lib/game-types";

export const EMPTY_ACTIVE_TEAM: ActiveTeam = [null, null, null];

export function retainExistingTeamIds(selected: string[], fighters: Fighter[]): string[] {
  const available = new Set(fighters.map((fighter) => fighter.id));
  return selected.map((id) => available.has(id) ? id : "");
}

export function normalizeActiveTeam(value: unknown, fighters: Fighter[]): ActiveTeam {
  if (!Array.isArray(value) || value.length !== 3) return [...EMPTY_ACTIVE_TEAM];
  const available = new Set(fighters.map((fighter) => fighter.id));
  const seen = new Set<string>();
  return value.map((entry) => {
    if (typeof entry !== "string" || !available.has(entry) || seen.has(entry)) return null;
    seen.add(entry);
    return entry;
  }) as ActiveTeam;
}

export function validActiveTeamSelection(value: unknown, fighters: Fighter[]): value is [string, string, string] {
  if (!Array.isArray(value) || value.length !== 3 || value.some((id) => typeof id !== "string" || !id)) return false;
  return new Set(value).size === 3 && value.every((id) => fighters.some((fighter) => fighter.id === id));
}

export function updateActiveTeam(current: ActiveTeam, selected: string[], fighters: Fighter[]): ActiveTeam | null {
  if (selected.length !== 3) return null;
  const normalized = selected.map((id) => id || null) as ActiveTeam;
  const ids = normalized.filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length || ids.some((id) => !fighters.some((fighter) => fighter.id === id))) return null;
  return normalized;
}

export function getDefaultBattleSelection(activeTeam: unknown, fighters: Fighter[]) {
  return validActiveTeamSelection(activeTeam, fighters) ? [...activeTeam] : ["", "", ""];
}
