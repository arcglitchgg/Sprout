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

export type BattleVisualActionEvent = {
  type: "action";
  sequence: number;
  simulatedTime: number;
  actorId: string;
  intendedTargetId: string;
  actualTargetId: string;
  actionId: ActionId;
  damage: number;
  resultingHp: number;
  ko: boolean;
  interceptedById?: string;
  dialogue?: string;
  logStartIndex: number;
  logEndIndex: number;
};

export type BattleVisualResultEvent = {
  type: "result";
  sequence: number;
  simulatedTime: number;
  status: Exclude<BattleStatus, "running">;
  logStartIndex: number;
  logEndIndex: number;
};

export type BattleVisualEvent = BattleVisualActionEvent | BattleVisualResultEvent;

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
  visualEvents: BattleVisualEvent[];
};
