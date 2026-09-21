import { FIGHTER_RARITY_MULTIPLIERS, personalities } from "@/lib/game-data";
import type { CropType, Fighter, MutationType, PersonalityType } from "@/lib/game-types";

export function generateFighter(source: { crop: CropType; mutation: MutationType }, random: () => number = Math.random): Fighter {
  const personalityKeys = Object.keys(
    personalities
  ) as PersonalityType[];

  const personality =
    personalityKeys[
    Math.floor(random() * personalityKeys.length)
    ];

  let hp = 100;
  let attack = 20;
  let defense = 20;
  let speed = 20;

  // Species identity
  if (source.crop === "potato") {
    hp += 30;
    defense += 10;
  }

  if (source.crop === "carrot") {
    speed += 15;
    attack += 5;
  }

  if (source.crop === "corn") {
    attack += 15;
  }

  // Mutation strength
  const mutationMultiplier = FIGHTER_RARITY_MULTIPLIERS[source.mutation];

  hp = Math.round(hp * mutationMultiplier);
  attack = Math.round(attack * mutationMultiplier);
  defense = Math.round(defense * mutationMultiplier);
  speed = Math.round(speed * mutationMultiplier);

  // Personality stat effects
  if (personality === "angry") {
    attack = Math.round(attack * 1.15);
    defense = Math.round(defense * 0.9);
  }

  if (personality === "protective") {
    defense = Math.round(defense * 1.15);
  }

  if (personality === "lazy") {
    attack = Math.round(attack * 1.25);
    speed = Math.round(speed * 0.85);
  }

  const fighter: Fighter = {
    id: crypto.randomUUID(),
    crop: source.crop,
    mutation: source.mutation,
    personality,
    hp,
    attack,
    defense,
    speed,
  };

  return fighter;
}
