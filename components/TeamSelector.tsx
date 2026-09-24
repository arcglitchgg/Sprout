import { FORMATION } from "@/lib/battle-data";
import { crops, mutations, personalities } from "@/lib/game-data";
import { getEffectiveFighter } from "@/lib/fighter-progression";
import type { Fighter } from "@/lib/game-types";

type Props = { fighters: Fighter[]; selected: string[]; onSelect: (ids: string[]) => void; locked: boolean };

export default function TeamSelector({ fighters, selected, onSelect, locked }: Props) {
  return (
    <fieldset disabled={locked} className="mt-4 space-y-3 disabled:opacity-60">
      <legend className="font-bold">Choose three fighters</legend>
      <p className="text-sm">Front takes normal attacks first. Personalities can target other fighters.</p>
      {fighters.length < 3 && <p className="text-sm">Awaken at least three fighters to battle.</p>}
      {FORMATION.map((slot, index) => (
        <label key={slot} className="block text-sm">
          {slot}
          <select className="mt-1 block w-full rounded-lg bg-[#fff8dc] p-2" value={selected[index]} onChange={(event) => onSelect(selected.map((id, i) => i === index ? event.target.value : id))}>
            <option value="">Choose a fighter</option>
            {fighters.map((fighter, rosterIndex) => {
              const effective = getEffectiveFighter(fighter);
              return <option key={fighter.id} value={fighter.id} disabled={selected.includes(fighter.id) && selected[index] !== fighter.id}>
                #{rosterIndex + 1} Lv. {fighter.level} {mutations[fighter.mutation].name} {crops[fighter.crop].name} — {personalities[fighter.personality].name} (HP {effective.hp}, ATK {effective.attack}, DEF {effective.defense}, SPD {effective.speed})
              </option>;
            })}
          </select>
        </label>
      ))}
    </fieldset>
  );
}
