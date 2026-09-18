import type { CropType } from "@/lib/game-types";
import type { ActionDefinition, ActionId } from "@/lib/skill-types";

export const ACTIONS: Record<ActionId, ActionDefinition> = {
  basic: { id: "basic", name: "Basic Attack", baseWeight: 60, attackMultiplier: 1, highImpact: false, targeting: "personality" },
  "heavy-slam": { id: "heavy-slam", name: "Heavy Slam", baseWeight: 25, attackMultiplier: 1.4, highImpact: true, targeting: "front" },
  backstab: { id: "backstab", name: "Backstab", baseWeight: 25, attackMultiplier: 1.3, highImpact: false, targeting: "rear" },
  "kernel-burst": { id: "kernel-burst", name: "Kernel Burst", baseWeight: 25, attackMultiplier: 1.6, highImpact: true, targeting: "lowest-defense" },
};

export const SPECIES_ACTIONS: Record<CropType, ActionId[]> = {
  potato: ["basic", "heavy-slam"],
  carrot: ["basic", "backstab"],
  corn: ["basic", "kernel-burst"],
};
