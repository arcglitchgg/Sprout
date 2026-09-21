import { generateFighter } from "@/lib/fighters";
import type { AscensionPity, CropType, Fighter, HarvestMutationType, MutationType } from "@/lib/game-types";

export const FUSION_UPGRADE_CHANCE = {
  normal: 0.30, large: 0.30, golden: 0.25, prismatic: 0.35,
} as const;
export const ASCENSION_HARD_PITY = 3;
export const INITIAL_ASCENSION_PITY: AscensionPity = { potato: 0, carrot: 0, corn: 0 };
const upgrade: Record<HarvestMutationType, MutationType> = {
  normal: "large", large: "golden", golden: "prismatic", prismatic: "ascended",
};

export type FusionEligibility =
  | { valid: true; crop: CropType; mutation: HarvestMutationType }
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
  if (first.mutation === "ascended") return { valid: false, reason: "Ascended fighters cannot be fused further." };
  return { valid: true, crop: first.crop, mutation: first.mutation };
}

export function fuseFighters(
  fighters: Fighter[], selectedIds: string[], random: () => number = Math.random,
  pity: AscensionPity = INITIAL_ASCENSION_PITY,
): { result: Fighter; remaining: Fighter[]; pity: AscensionPity } | null {
  const eligibility = getFusionEligibility(fighters, selectedIds);
  if (!eligibility.valid) return null;
  const { crop, mutation: input } = eligibility;
  // Preserve Normal's strict 0.70 boundary and existing RNG call order.
  const succeeded = input === "normal" ? random() >= 0.70
    : input === "prismatic" && pity[crop] >= ASCENSION_HARD_PITY - 1
      ? true : random() < FUSION_UPGRADE_CHANCE[input];
  const mutation = succeeded ? upgrade[input] : input;
  const result = generateFighter({ crop, mutation }, random);
  if (fighters.some((fighter) => fighter.id === result.id)) return null;
  const nextPity = input === "prismatic"
    ? { ...pity, [crop]: succeeded ? 0 : Math.min(ASCENSION_HARD_PITY - 1, pity[crop] + 1) }
    : { ...pity };
  const selected = new Set(selectedIds);
  return { result, remaining: [...fighters.filter((fighter) => !selected.has(fighter.id)), result], pity: nextPity };
}
