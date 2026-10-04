export type BattleEffectFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number;
};

export type BattleEffectDefinition = {
  src: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  frames: BattleEffectFrame[];
};

// Four 32x64 frames occupy the center band of the 128x128 source sheet.
// Playback runs from the faint slash toward the orange impact frame, which
// begins at the existing 1,150ms Backstab impact boundary.
export const CARROT_ASCENDED_BACKSTAB_EFFECT: BattleEffectDefinition = {
  src: "/assets/Character sprites/Fighters/Carrot/Ascended/Carrot_Skill.png",
  sheetWidth: 128,
  sheetHeight: 128,
  frameWidth: 32,
  frameHeight: 64,
  frames: [
    { x: 96, y: 32, width: 32, height: 64, duration: 300 },
    { x: 64, y: 32, width: 32, height: 64, duration: 350 },
    { x: 32, y: 32, width: 32, height: 64, duration: 500 },
    { x: 0, y: 32, width: 32, height: 64, duration: 350 },
  ],
};

export function getCarrotBackstabPresentation(crop: string, mutation: string) {
  if (crop !== "carrot") return null;
  return mutation === "ascended" ? "ascended-effect" : "vanish";
}
