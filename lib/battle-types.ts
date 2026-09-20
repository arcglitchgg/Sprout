import type { Fighter } from "@/lib/game-types";
import type { ActionDecision, ActionId } from "@/lib/skill-types";

export type BattleStatus = "running" | "victory" | "defeat" | "draw";
export type BattleMode = "dungeon" | "friendly-pvp";
export type BattleSide = "player" | "enemy";

export type Combatant = Fighter & {
  side: BattleSide;
  slot: number;
  currentHp: number;
  nextActionAt: number;
  actions: number;
  guardReady: boolean;
  lastActionId?: ActionId;
};

export type BattleEvent = { at: number; message: string };

export type BattleState = {
  id: string;
  mode: BattleMode;
  status: BattleStatus;
  elapsed: number;
  combatants: Combatant[];
  log: BattleEvent[];
  seed: number;
  rngState: number;
  decisions: ActionDecision[];
};
