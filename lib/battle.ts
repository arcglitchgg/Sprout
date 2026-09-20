import { BATTLE_DIALOGUE, BATTLE_LIMIT_MS, TRAINING_TEAM } from "@/lib/battle-data";
import { calculateDamage, getActionCandidates, rollAction } from "@/lib/skill-selection";
import { ACTIONS } from "@/lib/skill-data";
import { crops } from "@/lib/game-data";
import type { BattleSide, BattleState, Combatant } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";

export function actionInterval(speed: number) {
  return Math.max(1200, Math.min(5000, 3000 * 20 / speed));
}

export { calculateDamage } from "@/lib/skill-selection";

export function createBattle(team: Fighter[], id: string, seed = 0, enemyTeam: Fighter[] = TRAINING_TEAM, mode: "dungeon" | "friendly-pvp" = "dungeon"): BattleState {
  if (team.length !== 3 || new Set(team.map((fighter) => fighter.id)).size !== 3) {
    throw new Error("Select exactly three distinct fighters.");
  }
  if (enemyTeam.length !== 3 || new Set([...team, ...enemyTeam].map((fighter) => fighter.id)).size !== 6) throw new Error("Battle teams need six distinct fighters.");
  const copyTeam = (fighters: Fighter[], side: BattleSide): Combatant[] => fighters.map((fighter, slot) => ({
    ...fighter, side, slot, currentHp: fighter.hp, nextActionAt: actionInterval(fighter.speed),
    actions: 0, guardReady: fighter.personality === "protective",
  }));
  return { id, mode, seed: seed >>> 0, rngState: seed >>> 0, decisions: [], status: "running", elapsed: 0, combatants: [...copyTeam(team, "player"), ...copyTeam(enemyTeam, "enemy")], log: [{ at: 0, message: mode === "friendly-pvp" ? "Friendly PvP battle started." : "Training Garden battle started." }] };
}

export function createFriendlyBattle(challenger: Fighter[], opponent: Fighter[], id: string, seed: number) {
  return createBattle(challenger, id, seed, opponent, "friendly-pvp");
}

export function isRewardableDungeonVictory(battle: BattleState) {
  return battle.mode === "dungeon" && battle.status === "victory";
}

function label(fighter: Combatant) {
  return `${fighter.side === "player" ? "Your" : "Enemy"} ${crops[fighter.crop].name} (${fighter.slot + 1})`;
}

/** Pure elapsed-time simulation. Inputs and roster fighters are never mutated. */
export function advanceBattle(previous: BattleState, elapsed: number): BattleState {
  if (previous.status !== "running") return previous;
  const state: BattleState = { ...previous, combatants: previous.combatants.map((fighter) => ({ ...fighter })), log: [...previous.log], decisions: [...previous.decisions] };
  const until = Math.min(BATTLE_LIMIT_MS, Math.max(previous.elapsed, elapsed));
  const log = (message: string) => state.log.push({ at: state.elapsed, message });
  while (state.status === "running") {
    const playerAlive = state.combatants.some((fighter) => fighter.side === "player" && fighter.currentHp > 0);
    const enemyAlive = state.combatants.some((fighter) => fighter.side === "enemy" && fighter.currentHp > 0);
    if (!playerAlive || !enemyAlive) {
      state.status = playerAlive ? "victory" : enemyAlive ? "defeat" : "draw";
      log(`Battle ended: ${state.status}.`);
      break;
    }
    // Stable ties: higher Speed, then player side, then formation slot.
    const attacker = state.combatants.filter((fighter) => fighter.currentHp > 0).sort((a, b) =>
      a.nextActionAt - b.nextActionAt || b.speed - a.speed ||
      (a.side === b.side ? a.slot - b.slot : a.side === "player" ? -1 : 1)
    )[0];
    if (attacker.nextActionAt > until || attacker.nextActionAt >= BATTLE_LIMIT_MS) {
      state.elapsed = until;
      if (until === BATTLE_LIMIT_MS) { state.status = "draw"; log("Time limit reached: draw."); }
      break;
    }
    state.elapsed = attacker.nextActionAt;
    const enemies = state.combatants.filter((fighter) => fighter.side !== attacker.side && fighter.currentHp > 0);
    const candidates = getActionCandidates(attacker, state.combatants);
    const rngBefore = state.rngState;
    const { chosen, roll, nextState } = rollAction(candidates, rngBefore);
    state.rngState = nextState;
    const action = ACTIONS[chosen.actionId];
    let target = enemies.find((enemy) => enemy.id === chosen.targetId)!;
    const protector = enemies.filter((fighter) => fighter.personality === "protective" && fighter.guardReady && fighter !== target)
      .sort((a, b) => a.slot - b.slot).find((fighter) => {
        const weakestAlly = enemies.filter((ally) => ally !== fighter).sort((a, b) => a.currentHp - b.currentHp || a.slot - b.slot)[0];
        return weakestAlly === target;
      });
    if (protector) {
      log(`${label(protector)} intercepts a hit for ${label(target)}.`);
      protector.guardReady = false;
      target = protector; // No chained interceptions; use the recipient's DEF and HP.
    }
    state.decisions.push({ at: state.elapsed, actorId: attacker.id, rngBefore, rngAfter: nextState, roll, candidates, chosenAction: action.id, intendedTargetId: chosen.targetId, actualTargetId: target.id });
    const damage = calculateDamage(attacker, target, action.attackMultiplier);
    attacker.lastActionId = action.id;
    target.currentHp = Math.max(0, target.currentHp - damage);
    log(`${label(attacker)} uses ${action.name} on ${label(target)} for ${damage}.`);
    if (target.currentHp === 0) log(`${label(target)} is knocked out.`);
    attacker.actions += 1;
    if (attacker.actions % 3 === 0) log(`${label(attacker)}: “${BATTLE_DIALOGUE[attacker.personality]}”`);
    if (attacker.personality === "protective") attacker.guardReady = true;
    attacker.nextActionAt += actionInterval(attacker.speed);
  }
  return state;
}
