import { getEffectiveFighter } from "@/lib/fighter-progression";
import { calculateCombatPower } from "@/lib/social";
import { validActiveTeamSelection } from "@/lib/team-selection";
import type { ActiveTeam, Fighter } from "@/lib/game-types";

export function getActiveTeamFighters(activeTeam: ActiveTeam, fighters: Fighter[]) {
  if (!validActiveTeamSelection(activeTeam, fighters)) return null;
  return activeTeam.map((id) => fighters.find((fighter) => fighter.id === id)!);
}

export function getActiveTeamCombatPower(activeTeam: ActiveTeam, fighters: Fighter[]) {
  const team = getActiveTeamFighters(activeTeam, fighters);
  return team ? calculateCombatPower(team.map(getEffectiveFighter)) : null;
}

export function getActiveTeamTagline(activeTeam: ActiveTeam, fighters: Fighter[]) {
  const team = getActiveTeamFighters(activeTeam, fighters);
  if (!team) return "Three slots. Your next great idea.";
  const count = (key: string, values: string[]) => values.filter((value) => value === key).length;
  const species = team.map((fighter) => fighter.crop);
  const personalities = team.map((fighter) => fighter.personality);
  if (count("carrot", species) >= 2) return "Carrots first. Questions later.";
  if (count("potato", species) >= 2) return "Potato said hold the line.";
  if (count("angry", personalities) + count("mean", personalities) >= 2) return "Fast hands, bad attitudes.";
  if (count("protective", personalities) >= 2) return "Nobody gets left in the weeds.";
  return "Three sprouts. One bad idea.";
}
