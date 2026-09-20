import type { Fighter } from "@/lib/game-types";

export type LivePvpMatch = {
  id: string;
  challengerId: string;
  opponentId: string;
  status: "pending_acceptance" | "waiting_for_teams" | "ready" | "active" | "completed" | "cancelled" | "expired";
  battleId: string | null;
  battleSeed: number | null;
  challengerTeam: Fighter[] | null;
  opponentTeam: Fighter[] | null;
  expiresAt: string;
};
