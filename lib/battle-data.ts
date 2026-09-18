import type { Fighter, PersonalityType } from "@/lib/game-types";

export const BATTLE_LIMIT_MS = 60_000;
export const VICTORY_COINS = 20;
export const FORMATION = ["Front", "Rear Left", "Rear Right"];

// Normal mutations; existing species and personality stat bonuses included once.
export const TRAINING_TEAM: Fighter[] = [
  { id: "enemy-potato", crop: "potato", mutation: "normal", personality: "protective", hp: 130, attack: 20, defense: 35, speed: 20 },
  { id: "enemy-carrot", crop: "carrot", mutation: "normal", personality: "clever", hp: 100, attack: 25, defense: 20, speed: 35 },
  { id: "enemy-corn", crop: "corn", mutation: "normal", personality: "lazy", hp: 100, attack: 44, defense: 20, speed: 17 },
];

export const BATTLE_DIALOGUE: Record<PersonalityType, string> = {
  angry: "MOVE, YOU ****ING WEED.",
  protective: "Behind me, sprouts!",
  lazy: "Fine. One good hit.",
  clever: "Found your soft spot.",
  mean: "Looking a little wilted.",
};
