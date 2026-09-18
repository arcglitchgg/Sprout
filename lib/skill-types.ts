export type ActionId = "basic" | "heavy-slam" | "backstab" | "kernel-burst";

export type ActionDefinition = {
  id: ActionId;
  name: string;
  baseWeight: number;
  attackMultiplier: number;
  highImpact: boolean;
  targeting: "personality" | "front" | "rear" | "lowest-defense";
};

export type ActionCandidate = {
  actionId: ActionId;
  targetId: string;
  baseWeight: number;
  weight: number;
  estimatedDamage: number;
  reasons: string[];
};

export type ActionDecision = {
  at: number;
  actorId: string;
  rngBefore: number;
  rngAfter: number;
  roll: number;
  candidates: ActionCandidate[];
  chosenAction: ActionId;
  intendedTargetId: string;
  actualTargetId: string;
};
