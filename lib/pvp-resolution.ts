import { advanceBattle, createFriendlyBattle } from "@/lib/battle";
import type { LivePvpMatch } from "@/lib/pvp-types";

export type PvpResult = "challenger" | "opponent" | "draw";

/** Resolve the stored, server-validated teams. No client result enters this boundary. */
export function resolvePvpMatch(match: LivePvpMatch): { winnerId: string | null; result: PvpResult } {
  if (!match.challengerTeam || !match.opponentTeam || !match.battleId || !Number.isSafeInteger(match.battleSeed)) {
    throw new Error("Match snapshot is incomplete.");
  }
  const battle = advanceBattle(createFriendlyBattle(match.challengerTeam, match.opponentTeam, match.battleId, match.battleSeed!), 60000);
  if (battle.status === "running") throw new Error("Battle did not finish.");
  if (battle.status === "draw") return { winnerId: null, result: "draw" };
  return battle.status === "victory"
    ? { winnerId: match.challengerId, result: "challenger" }
    : { winnerId: match.opponentId, result: "opponent" };
}
