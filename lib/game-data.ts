import type { CropType, CropDefinition, HarvestMutationType, MutationType, MutationDefinition, PersonalityType } from "@/lib/game-types";

export const HARVEST_MUTATIONS: HarvestMutationType[] = ["normal", "large", "golden", "prismatic"];
export const FIGHTER_RARITY_MULTIPLIERS: Record<MutationType, number> = {
  normal: 1, large: 1.1, golden: 1.25, prismatic: 1.5, ascended: 1.5 * 1.15,
};

export const crops: Record<CropType, CropDefinition> = {
  potato: {
    name: "Potato",
    emoji: "🥔",
    cost: 5,
    sellPrice: 10,
    growTime: 10,
  },
  carrot: {
    name: "Carrot",
    emoji: "🥕",
    cost: 8,
    sellPrice: 18,
    growTime: 20,
  },
  corn: {
    name: "Corn",
    emoji: "🌽",
    cost: 12,
    sellPrice: 30,
    growTime: 30,
  },
};

export const mutations: Record<MutationType, MutationDefinition> = {
  normal: {
    name: "Normal",
    multiplier: 1,
    chance: 85,
    label: "⚪",
  },
  large: {
    name: "Large",
    multiplier: 1.5,
    chance: 10,
    label: "🟢",
  },
  golden: {
    name: "Golden",
    multiplier: 3,
    chance: 4,
    label: "⭐",
  },
  prismatic: {
    name: "Prismatic",
    multiplier: 10,
    chance: 1,
    label: "🌈",
  },
  ascended: {
    name: "Ascended",
    multiplier: 10,
    chance: 0,
    label: "✦",
  },
};

export const personalities: Record<
  PersonalityType,
  {
    name: string;
    emoji: string;
    description: string;
  }
> = {
  angry: {
    name: "Angry",
    emoji: "😡",
    description: "+15% ATK, -10% DEF",
  },
  protective: {
    name: "Protective",
    emoji: "🛡️",
    description: "+15% DEF",
  },
  lazy: {
    name: "Lazy",
    emoji: "😴",
    description: "+25% ATK, -15% Speed",
  },
  clever: {
    name: "Clever",
    emoji: "🤓",
    description: "+10% Skill Power",
  },
  mean: {
    name: "Mean",
    emoji: "😈",
    description: "+15% damage to weakened enemies",
  },
};
