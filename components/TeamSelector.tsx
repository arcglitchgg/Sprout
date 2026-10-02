"use client";

import { useState } from "react";
import FighterCard from "@/components/FighterCard";
import FighterSelectionGrid from "@/components/FighterSelectionGrid";
import { FORMATION } from "@/lib/battle-data";
import type { Fighter } from "@/lib/game-types";
import type { RosterRarityFilter, RosterSpeciesFilter } from "@/lib/fighter-roster";

type Props = { fighters: Fighter[]; selected: string[]; onSelect: (ids: string[]) => void; locked: boolean };

export default function TeamSelector({ fighters, selected, onSelect, locked }: Props) {
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [rarity, setRarity] = useState<RosterRarityFilter>("all");
  const [species, setSpecies] = useState<RosterSpeciesFilter>("all");
  const normalized = FORMATION.map((_, index) => selected[index] ?? "");
  const currentId = editingSlot === null ? null : normalized[editingSlot] || null;

  function assignFighter(fighterId: string) {
    if (editingSlot === null) return;
    const next = [...normalized];
    next[editingSlot] = fighterId;
    onSelect(next);
    setEditingSlot(null);
  }

  function removeFighter() {
    if (editingSlot === null) return;
    const next = [...normalized];
    next[editingSlot] = "";
    onSelect(next);
    setEditingSlot(null);
  }

  return <fieldset disabled={locked} className="mt-4 space-y-3 disabled:opacity-60">
    <legend className="font-bold">Choose three fighters</legend>
    <p className="text-sm">Front takes normal attacks first. Personalities can target other fighters.</p>
    {fighters.length < 3 && <p className="text-sm">Awaken at least three fighters to battle.</p>}
    {editingSlot === null ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FORMATION.map((slot, index) => { const fighter = fighters.find((entry) => entry.id === normalized[index]); return <section key={slot} className="min-w-0"><h3 className="mb-1 text-xs font-black uppercase tracking-wide">{slot}</h3>{fighter ? <FighterCard fighter={fighter} compact selectable selected formationLabel={slot} onSelect={() => setEditingSlot(index)} /> : <button type="button" onClick={() => setEditingSlot(index)} className="flex min-h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-[#765438]/45 bg-[#fff8dc]/70 p-4 font-bold hover:border-[#4f772d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f772d]">+ Choose Fighter</button>}</section>; })}
    </div> : <div className="max-h-[min(70dvh,38rem)] overflow-y-auto rounded-xl border-2 border-[#765438]/30 bg-[#efe2b8] p-3">
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#efe2b8]/95 px-1 py-2 backdrop-blur-sm"><h3 className="font-black">Choose {FORMATION[editingSlot].toUpperCase()}</h3><div className="flex gap-2">{currentId && <button type="button" onClick={removeFighter} className="rounded-lg border border-[#9b3d25]/50 px-3 py-1.5 text-xs font-bold text-[#8b2f24]">Remove Fighter</button>}<button type="button" onClick={() => setEditingSlot(null)} className="rounded-lg border border-[#765438]/40 px-3 py-1.5 text-xs font-bold">Back</button></div></div>
      <TeamPickerFilters rarity={rarity} species={species} onRarity={setRarity} onSpecies={setSpecies} />
      <FighterSelectionGrid fighters={fighters} selectedFighterId={currentId} onSelect={assignFighter} rarityFilter={rarity} speciesFilter={species} formationLabel={FORMATION[editingSlot]} isFighterDisabled={(fighter) => normalized.some((id, index) => index !== editingSlot && id === fighter.id)} />
    </div>}
  </fieldset>;
}

function TeamPickerFilters({ rarity, species, onRarity, onSpecies }: { rarity: RosterRarityFilter; species: RosterSpeciesFilter; onRarity: (value: RosterRarityFilter) => void; onSpecies: (value: RosterSpeciesFilter) => void }) {
  const rarities: RosterRarityFilter[] = ["all", "favorites", "normal", "large", "golden", "prismatic", "ascended"];
  const speciesValues: RosterSpeciesFilter[] = ["all", "potato", "carrot", "corn"];
  return <div className="mb-3 space-y-2"><div className="flex flex-wrap gap-1.5" aria-label="Fighter rarity filter">{rarities.map((value) => <button key={value} type="button" aria-pressed={rarity === value} onClick={() => onRarity(value)} className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${rarity === value ? "bg-[#4f772d] text-white" : "bg-[#fff8dc]"}`}>{value}</button>)}</div><div className="flex flex-wrap gap-1.5" aria-label="Fighter species filter">{speciesValues.map((value) => <button key={value} type="button" aria-pressed={species === value} onClick={() => onSpecies(value)} className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${species === value ? "bg-[#765438] text-white" : "bg-[#fff8dc]"}`}>{value === "all" ? "All species" : value}</button>)}</div></div>;
}

export function TeamCardPreview({ fighters, selected }: { fighters: Fighter[]; selected: string[] }) {
  return <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{FORMATION.map((slot, index) => { const fighter = fighters.find((entry) => entry.id === selected[index]); return <section key={slot} className="min-w-0"><h3 className="mb-1 text-xs font-black uppercase tracking-wide">{slot}</h3>{fighter ? <FighterCard fighter={fighter} compact formationLabel={slot} /> : <div className="rounded-xl border-2 border-dashed border-[#765438]/30 p-3 text-xs">Empty slot</div>}</section>; })}</div>;
}
