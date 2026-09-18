import type { CropType, PersonalityType } from "@/lib/game-types";

export type BattleAnimationName = "idle" | "normal-attack" | "guard" | "skill";
export type BattleAnimation = { frames: string[]; frameDurationsMs: number[]; loop: boolean };
type FighterAnimations = Partial<Record<BattleAnimationName, BattleAnimation>>;

const root = "/assets/plant-animation-sprites/cleaned";
const framePaths = (species: CropType, personality: PersonalityType, name: BattleAnimationName, count: number) =>
  Array.from({ length: count }, (_, index) => `${root}/${species}/${personality}/${name}/frame-${String(index + 1).padStart(2, "0")}.png`);
const animation = (species: CropType, personality: PersonalityType, name: BattleAnimationName, count: number, frameDurationsMs: number[], loop = false): BattleAnimation => ({
  frames: framePaths(species, personality, name, count), frameDurationsMs, loop,
});

const personalityTypes: PersonalityType[] = ["angry", "protective", "lazy", "clever", "mean"];
const speciesTypes: CropType[] = ["potato", "carrot", "corn"];
const mapped = Object.fromEntries(speciesTypes.flatMap((species) => personalityTypes.map((personality) => [
  `${species}:${personality}`,
  {
    idle: animation(species, personality, "idle", 1, [900], true),
    "normal-attack": animation(species, personality, "normal-attack", 3, [450, 350, 500]),
  } satisfies FighterAnimations,
]))) as Record<`${CropType}:${PersonalityType}`, FighterAnimations>;

const add = (species: CropType, personality: PersonalityType, name: BattleAnimationName, count: number, durations: number[]) => {
  mapped[`${species}:${personality}`][name] = animation(species, personality, name, count, durations);
};

// Guard and Skill entries are deliberately limited to sets classified READY.
add("potato", "mean", "guard", 2, [450, 950]);
add("potato", "protective", "guard", 2, [450, 950]);
for (const personality of personalityTypes) add("carrot", personality, "guard", 2, [450, 950]);
for (const personality of ["angry", "clever", "lazy", "mean"] satisfies PersonalityType[]) add("corn", personality, "guard", 2, [450, 950]);

add("potato", "angry", "skill", 2, [700, 1200]);
add("potato", "lazy", "skill", 2, [700, 1200]);
add("corn", "angry", "skill", 3, [500, 650, 750]);
add("corn", "lazy", "skill", 3, [500, 650, 750]);

export const BATTLE_ANIMATIONS = mapped;
export function getBattleAnimation(species: CropType, personality: PersonalityType, name: BattleAnimationName) {
  return BATTLE_ANIMATIONS[`${species}:${personality}`][name];
}
