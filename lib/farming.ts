import { crops, mutations } from "@/lib/game-data";
import type { CropType, HarvestMutationType, Plot } from "@/lib/game-types";

export function rollMutation(): HarvestMutationType {
  const roll = Math.random() * 100;

  if (roll < mutations.prismatic.chance) {
    return "prismatic";
  }

  if (
    roll <
    mutations.prismatic.chance + mutations.golden.chance
  ) {
    return "golden";
  }

  if (
    roll <
    mutations.prismatic.chance +
    mutations.golden.chance +
    mutations.large.chance
  ) {
    return "large";
  }

  return "normal";
}

export function getSecondsRemaining(plot: Plot, now: number) {
  if (!plot.crop || !plot.plantedAt) return 0;

  const crop = crops[plot.crop];
  const elapsedSeconds = Math.floor(
    (now - plot.plantedAt) / 1000
  );

  return Math.max(crop.growTime - elapsedSeconds, 0);
}

export function isReady(plot: Plot, now: number) {
  return plot.crop !== null && getSecondsRemaining(plot, now) === 0;
}


export function getHarvestValue(crop: CropType, mutation: HarvestMutationType) {
  return Math.round(crops[crop].sellPrice * mutations[mutation].multiplier);
}
