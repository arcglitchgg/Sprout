import type { ActiveTeam, Fighter, TeamPreset, TeamPresetIndex, TeamPresets } from "@/lib/game-types";

export const EMPTY_ACTIVE_TEAM: ActiveTeam = [null, null, null];
export const DEFAULT_TEAM_PRESETS: TeamPresets = [
  { name: "Team 1", front: null, rearLeft: null, rearRight: null },
  { name: "Team 2", front: null, rearLeft: null, rearRight: null },
  { name: "Team 3", front: null, rearLeft: null, rearRight: null },
];

export function presetToActiveTeam(preset: TeamPreset): ActiveTeam { return [preset.front, preset.rearLeft, preset.rearRight]; }
export function activeTeamToPreset(team: ActiveTeam, name: string): TeamPreset { return { name, front: team[0], rearLeft: team[1], rearRight: team[2] }; }
export function normalizeTeamPresets(value: unknown, legacyTeam: unknown, fighters: Fighter[]): TeamPresets {
  const source = Array.isArray(value) && value.length === 3 ? value : null;
  return DEFAULT_TEAM_PRESETS.map((fallback, index) => {
    const raw = source?.[index];
    const name = raw && typeof raw === "object" && "name" in raw && typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 20) : fallback.name;
    const team = raw && typeof raw === "object"
      ? normalizeActiveTeam(["front", "rearLeft", "rearRight"].map((key) => key in raw ? (raw as Record<string, unknown>)[key] : null), fighters)
      : index === 0 ? normalizeActiveTeam(legacyTeam, fighters) : [...EMPTY_ACTIVE_TEAM];
    return activeTeamToPreset(team as ActiveTeam, name);
  }) as TeamPresets;
}
export function normalizeDefaultTeamPreset(value: unknown): TeamPresetIndex { return value === 1 || value === 2 ? value : 0; }
export function clearMissingPresetIds(presets: TeamPresets, fighters: Fighter[]): TeamPresets {
  return presets.map((preset) => activeTeamToPreset(normalizeActiveTeam(presetToActiveTeam(preset), fighters), preset.name)) as TeamPresets;
}
export function updateTeamPreset(presets: TeamPresets, index: TeamPresetIndex, selected: string[], fighters: Fighter[]): TeamPresets | null {
  const nextTeam = updateActiveTeam(presetToActiveTeam(presets[index]), selected, fighters);
  if (!nextTeam) return null;
  return presets.map((preset, current) => current === index ? activeTeamToPreset(nextTeam, preset.name) : preset) as TeamPresets;
}
export function renameTeamPreset(presets: TeamPresets, index: TeamPresetIndex, name: string): TeamPresets | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 20 || /[\r\n]/.test(name)) return null;
  return presets.map((preset, current) => current === index ? { ...preset, name: trimmed } : preset) as TeamPresets;
}
export function getDefaultPresetTeam(presets: TeamPresets, defaultIndex: TeamPresetIndex): ActiveTeam { return presetToActiveTeam(presets[defaultIndex]); }

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
