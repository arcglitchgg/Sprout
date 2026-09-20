import type { Fighter } from "@/lib/game-types";
import type { BattleStatus } from "@/lib/battle-types";
import type { LivePvpMatch } from "@/lib/pvp-types";

export function validPvpTeamSelection(ids: string[], roster: Fighter[]) {
  return ids.length === 3 && ids.every((id) => Boolean(id) && roster.some((fighter) => fighter.id === id)) && new Set(ids).size === 3;
}

export function shouldCancelSetupOnLeave(seenOpponent: boolean, opponentPresent: boolean, status: LivePvpMatch["status"] | null) {
  return seenOpponent && !opponentPresent && (status === "pending_acceptance" || status === "waiting_for_teams");
}

export function friendlyResultForLocal(status: BattleStatus, localIsChallenger: boolean) {
  if (status === "running") return "Battle in progress";
  if (status === "draw") return "Draw";
  return (status === "victory") === localIsChallenger ? "Victory" : "Defeat";
}
