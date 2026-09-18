import type { Combatant } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";
import { ACTIONS, SPECIES_ACTIONS } from "@/lib/skill-data";
import type { ActionCandidate, ActionDefinition } from "@/lib/skill-types";

export function calculateDamage(attacker: Fighter, target: Fighter & { currentHp: number }, multiplier = 1) {
  const bonus = attacker.personality === "mean" && target.currentHp < target.hp / 2 ? 1.15 : 1;
  return Math.max(1, Math.round(attacker.attack * multiplier * 100 / (100 + target.defense) * bonus));
}

/** Species preferences take priority for skills; personality selects basic targets and breaks skill ties. */
export function selectActionTarget(attacker: Combatant, enemies: Combatant[], action: ActionDefinition) {
  const living = enemies.filter((enemy) => enemy.currentHp > 0);
  const personalityOrder = (a: Combatant, b: Combatant) => {
    if (attacker.personality === "angry") return a.currentHp - b.currentHp;
    if (attacker.personality === "clever") return calculateDamage(attacker, b, action.attackMultiplier) - calculateDamage(attacker, a, action.attackMultiplier);
    if (attacker.personality === "mean") {
      const aLow = a.currentHp < a.hp / 2;
      const bLow = b.currentHp < b.hp / 2;
      return Number(bLow) - Number(aLow) || (aLow && bLow ? a.currentHp / a.hp - b.currentHp / b.hp : 0);
    }
    return 0;
  };
  return living.sort((a, b) => {
    let preference = 0;
    if (action.targeting === "front") preference = a.slot - b.slot;
    if (action.targeting === "rear") preference = Number(a.slot === 0) - Number(b.slot === 0) || a.currentHp - b.currentHp;
    if (action.targeting === "lowest-defense") preference = a.defense - b.defense;
    return preference || personalityOrder(a, b) || a.slot - b.slot;
  })[0];
}

export function getActionCandidates(attacker: Combatant, combatants: Combatant[]): ActionCandidate[] {
  const enemies = combatants.filter((fighter) => fighter.side !== attacker.side);
  return SPECIES_ACTIONS[attacker.crop].flatMap((id) => {
    const action = ACTIONS[id];
    const target = selectActionTarget(attacker, enemies, action);
    if (!target) return [];
    const damage = calculateDamage(attacker, target, action.attackMultiplier);
    const lethal = damage >= target.currentHp;
    let weight = action.baseWeight;
    const reasons: string[] = [];
    const modify = (multiplier: number, reason: string) => { weight *= multiplier; reasons.push(`${reason} ×${multiplier}`); };
    const skill = id !== "basic";
    if (attacker.personality === "angry" && skill) {
      modify(1.6, "Offensive skill");
      if (target.currentHp < target.hp / 2) modify(1.5, "Low-HP target");
      const fallen = combatants.filter((fighter) => fighter.side === attacker.side && fighter.currentHp === 0).length;
      if (fallen) modify(Math.min(1.5, 1 + fallen * 0.25), "Fallen allies");
    }
    if (attacker.personality === "protective") modify(skill ? 0.6 : 1.3, "Safer basic preference");
    if (attacker.personality === "lazy" && skill) modify(action.highImpact ? 4 : 2, "High-impact preference");
    if (attacker.personality === "clever") {
      const reference = Math.max(1, calculateDamage(attacker, target));
      const value = Math.min(damage, target.currentHp) / reference + (lethal ? 1 : 0);
      modify(Math.max(0.5, Math.min(2.5, value)), "Immediate damage and knockout value");
    }
    if (attacker.personality === "mean") {
      if (target.currentHp < target.hp / 2) modify(1.5, "Low-HP target");
      if (lethal) modify(3, "Finisher");
    }
    if (lethal && attacker.personality !== "mean") modify(1.5, "Knockout opportunity");
    if (skill && attacker.lastActionId === id) modify(0.65, "Recent skill use");
    return [{ actionId: id, targetId: target.id, baseWeight: action.baseWeight, weight, estimatedDamage: damage, reasons }];
  });
}

/** Mulberry32: one deterministic unsigned state transition per action choice, including seed zero. */
export function rollAction(candidates: ActionCandidate[], rngState: number) {
  const available = candidates.filter((candidate) => Number.isFinite(candidate.weight) && candidate.weight > 0);
  const total = available.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (!available.length || !Number.isFinite(total)) throw new Error("No valid weighted actions.");
  const nextState = (rngState + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  const roll = ((value ^ value >>> 14) >>> 0) / 4294967296;
  let remaining = roll * total;
  const chosen = available.find((candidate) => { remaining -= candidate.weight; return remaining < 0; }) ?? available[available.length - 1];
  return { chosen, roll, nextState };
}
