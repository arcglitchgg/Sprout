import { crops, mutations, personalities } from "@/lib/game-data";
import { getEffectiveFighter, getFighterXpProgress } from "@/lib/fighter-progression";
import { getNaturalStatDisplayState } from "@/lib/fighters";
import type { FighterStat } from "@/lib/fighters";
import type { Fighter } from "@/lib/game-types";

const STAT_DISPLAY: { stat: FighterStat; label: string; icon: string }[] = [
  { stat: "hp", label: "HP", icon: "❤️" }, { stat: "attack", label: "ATK", icon: "⚔️" },
  { stat: "defense", label: "DEF", icon: "🛡️" }, { stat: "speed", label: "Speed", icon: "⚡" },
];

export type FighterCardProps = {
  fighter: Fighter;
  compact?: boolean;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  selectionLabel?: string;
  formationLabel?: string;
  onSelect?: (fighterId: string) => void;
  className?: string;
};

export default function FighterCard({ fighter, compact = false, selectable = false, selected = false, disabled = false, selectionLabel, formationLabel, onSelect, className = "" }: FighterCardProps) {
  const effective = getEffectiveFighter(fighter);
  const progress = getFighterXpProgress(fighter);
  const species = `${mutations[fighter.mutation].name} ${crops[fighter.crop].name}`;
  const descriptor = `${mutations[fighter.mutation].label} ${crops[fighter.crop].emoji} ${species}`;
  const cardClass = `relative w-full rounded-xl border-2 text-left ${compact ? "p-3" : "p-4"} ${selectable ? "transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4f772d]/45" : ""} ${selected ? "border-[#4f772d] bg-[#d9ed92] shadow-sm" : "border-transparent bg-[#fff8dc]"} ${disabled ? "cursor-not-allowed opacity-55" : selectable ? "cursor-pointer hover:border-[#4f772d]/60" : ""} ${className}`;
  const content = <>
    {selected && <span aria-hidden="true" className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-[#4f772d] text-sm font-black text-white">✓</span>}
    {formationLabel && <span className="mb-2 inline-block rounded-full bg-[#765438] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">{formationLabel}</span>}
    <div className={`flex items-start justify-between gap-2 font-bold ${selected ? "pr-7" : ""} ${compact ? "text-base" : "text-lg"}`}><span>{fighter.name || descriptor}</span><span className="flex gap-1 text-xs">{fighter.favorite && <span title="Favorite" aria-label="Favorite fighter">★</span>}{fighter.locked && <span title="Locked" aria-label="Locked fighter">🔒</span>}</span></div>
    {fighter.name && <div className="text-xs font-bold opacity-70">{species} · Lv. {fighter.level}</div>}
    <div className="mt-1 text-sm font-bold">{personalities[fighter.personality].emoji} {personalities[fighter.personality].name}</div>
    {!fighter.name && <div className="mt-1 text-xs font-black text-[#4f772d]">Lv. {fighter.level}</div>}
    {!compact && <><div className="mt-1" aria-label={`${progress.current} of ${progress.required} XP toward next level`}><div className="h-1.5 overflow-hidden rounded-full bg-[#765438]/20"><div className="h-full rounded-full bg-[#7aa33d]" style={{ width: `${progress.percent}%` }} /></div><p className="mt-0.5 text-[10px] font-bold tabular-nums opacity-70">{progress.current} / {progress.required} XP</p></div><div className="text-xs opacity-60">{personalities[fighter.personality].description}</div></>}
    <div className={`${compact ? "mt-2" : "mt-3"} grid grid-cols-4 gap-1 text-center text-xs sm:gap-2`}>{STAT_DISPLAY.map(({ stat, label, icon }) => { const perfect = getNaturalStatDisplayState(fighter, stat) === "prismatic"; return <div key={stat} title={perfect ? `Perfect ${label} roll` : undefined} aria-label={perfect ? `${label} ${effective[stat]}. Perfect ${label} roll` : `${label} ${effective[stat]}`}><span aria-hidden="true" className={perfect ? "fighter-stat-perfect-icon" : undefined}>{icon}</span><span className="block font-bold">{effective[stat]}</span>{perfect && <span className="block whitespace-nowrap text-[9px] font-black leading-none text-[#7b2fa1]">✦ MAX</span>}</div>; })}</div>
    {selectionLabel && <span className="mt-2 block text-xs font-bold">{selectionLabel}</span>}
  </>;
  if (selectable) return <button type="button" disabled={disabled} aria-pressed={selected} aria-label={`${selected ? "Deselect" : "Select"} ${fighter.name || species}`} onClick={() => onSelect?.(fighter.id)} className={cardClass}>{content}</button>;
  return <div className={cardClass}>{content}</div>;
}
