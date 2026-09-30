import { crops, mutations, personalities } from "@/lib/game-data";
import { getEffectiveFighter } from "@/lib/fighter-progression";
import { getNaturalStatDisplayState } from "@/lib/fighters";
import type { FighterStat } from "@/lib/fighters";
import type { Fighter } from "@/lib/game-types";

const STAT_DISPLAY: { stat: FighterStat; label: string; icon: string }[] = [
  { stat: "hp", label: "HP", icon: "❤️" },
  { stat: "attack", label: "ATK", icon: "⚔️" },
  { stat: "defense", label: "DEF", icon: "🛡️" },
  { stat: "speed", label: "Speed", icon: "⚡" },
];

export default function FighterCard({ fighter }: { fighter: Fighter }) {
  const effective = getEffectiveFighter(fighter);
  return (
    <div className="rounded-xl bg-[#fff8dc] p-4">
      <div className="flex items-start justify-between gap-2 text-lg font-bold">
        <span>{mutations[fighter.mutation].label} {crops[fighter.crop].emoji} {mutations[fighter.mutation].name} {crops[fighter.crop].name}</span>
        {fighter.locked && <span className="text-xs" title="Locked" aria-label="Locked fighter">🔒</span>}
      </div>

      <div className="mt-1 text-sm font-bold">{personalities[fighter.personality].emoji} {personalities[fighter.personality].name}</div>
      <div className="mt-1 text-xs font-black text-[#4f772d]">Lv. {fighter.level}</div>
      <div className="text-xs opacity-60">{personalities[fighter.personality].description}</div>

      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs sm:gap-2">
        {STAT_DISPLAY.map(({ stat, label, icon }) => {
          const perfect = getNaturalStatDisplayState(fighter, stat) === "prismatic";
          return <div key={stat} title={perfect ? `Perfect ${label} roll` : undefined} aria-label={perfect ? `${label} ${effective[stat]}. Perfect ${label} roll` : `${label} ${effective[stat]}`}>
            <span aria-hidden="true" className={perfect ? "fighter-stat-perfect-icon" : undefined}>{icon}</span>
            <span className="block font-bold">{effective[stat]}</span>
            {perfect && <span className="block whitespace-nowrap text-[9px] font-black leading-none text-[#7b2fa1]">✦ MAX</span>}
          </div>;
        })}
      </div>
    </div>
  );
}
