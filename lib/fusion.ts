import { generateFighter } from "@/lib/fighters";
import type { Fighter } from "@/lib/game-types";

export type FusionEligibility =
  | { valid: true; crop: Fighter["crop"]; mutation: "normal" | "large" }
  | { valid: false; reason: string };

export function getFusionEligibility(fighters: Fighter[], selectedIds: string[]): FusionEligibility {
  if (selectedIds.length !== 4) return { valid: false, reason: "Select exactly four fighters." };
  const ids = new Set(selectedIds);
  if (ids.size !== 4) return { valid: false, reason: "Choose four different fighters." };
  const selected = selectedIds.map((id) => fighters.find((fighter) => fighter.id === id));
  if (selected.some((fighter) => !fighter)) return { valid: false, reason: "A selected fighter is no longer in your roster." };
  const [first] = selected as Fighter[];
  if (selected.some((fighter) => fighter?.crop !== first.crop)) return { valid: false, reason: "All four fighters must be the same species." };
  if (selected.some((fighter) => fighter?.mutation !== first.mutation)) return { valid: false, reason: "All four fighters must have the same mutation." };
  if (first.mutation !== "normal" && first.mutation !== "large") return { valid: false, reason: "Golden and Prismatic fighters cannot be fused yet." };
  return { valid: true, crop: first.crop, mutation: first.mutation };
}

export function fuseFighters(fighters: Fighter[], selectedIds: string[], random: () => number = Math.random): { result: Fighter; remaining: Fighter[] } | null {
  const eligibility = getFusionEligibility(fighters, selectedIds);
  if (!eligibility.valid) return null;

  const mutation = eligibility.mutation === "large" || random() >= 0.70 ? "large" : "normal";
  const result = generateFighter({ crop: eligibility.crop, mutation }, random);
  if (fighters.some((fighter) => fighter.id === result.id)) return null;
  const selected = new Set(selectedIds);
  return { result, remaining: [...fighters.filter((fighter) => !selected.has(fighter.id)), result] };
}
