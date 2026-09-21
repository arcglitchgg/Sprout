import type { Fighter, Plot } from "@/lib/game-types";

export type SproutProfile = {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  farmLevel: number;
  coins: number;
  combatPower: number;
  pvpWins: number;
};

export type FriendLists = { friends: SproutProfile[]; incoming: SproutProfile[]; outgoing: SproutProfile[] };
export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove";
export type DefenseFighter = Fighter & { slot: number };
export type DefenseTeam = { fighters: DefenseFighter[]; combatPower: number; sourceSaveRevision: number | null };
export type FriendFarmSnapshot = { owner: SproutProfile; farmXp: number; unlockedPlotCount: number; plots: Plot[] };
export type WorldContext = { mode: "own-farm" } | { mode: "visiting"; ownerId: string; snapshot: FriendFarmSnapshot };
export type WorldPlayer = {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  facing: "left" | "right";
  isOwner: boolean;
  isLocal: boolean;
  online: boolean;
  reconnecting?: boolean;
  frame?: number;
  moving?: boolean;
};
