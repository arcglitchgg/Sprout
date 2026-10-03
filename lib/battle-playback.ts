import type { BattleState, BattleStatus, BattleVisualEvent } from "@/lib/battle-types";

export type BattlePlaybackState = {
  displayedHp: Record<string, number>;
  visibleLogCount: number;
  visibleStatus: BattleStatus | null;
  complete: boolean;
};

export function createBattlePlayback(battle: BattleState): BattlePlaybackState {
  return {
    displayedHp: Object.fromEntries(battle.combatants.map((fighter) => [fighter.id, fighter.hp])),
    visibleLogCount: 0,
    visibleStatus: null,
    complete: false,
  };
}

export function applyBattleVisualEvent(state: BattlePlaybackState, event: BattleVisualEvent): BattlePlaybackState {
  if (event.type === "result") {
    return { ...state, visibleLogCount: event.logEndIndex, visibleStatus: event.status, complete: true };
  }
  return {
    ...state,
    displayedHp: { ...state.displayedHp, [event.actualTargetId]: event.resultingHp },
    visibleLogCount: event.logEndIndex,
  };
}
