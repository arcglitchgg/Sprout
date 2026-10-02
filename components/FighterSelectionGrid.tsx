import FighterCard from "@/components/FighterCard";
import { filterFighterRoster } from "@/lib/fighter-roster";
import type { RosterRarityFilter, RosterSpeciesFilter } from "@/lib/fighter-roster";
import type { Fighter } from "@/lib/game-types";

type Props = {
  fighters: Fighter[];
  selectedFighterId?: string | null;
  onSelect: (fighterId: string) => void;
  compact?: boolean;
  disabled?: boolean;
  rarityFilter?: RosterRarityFilter;
  speciesFilter?: RosterSpeciesFilter;
  formationLabel?: string;
  emptyMessage?: string;
  isFighterDisabled?: (fighter: Fighter) => boolean;
};

export default function FighterSelectionGrid({ fighters, selectedFighterId, onSelect, compact = true, disabled = false, rarityFilter = "all", speciesFilter = "all", formationLabel, emptyMessage = "No fighters match these filters.", isFighterDisabled }: Props) {
  const visible = filterFighterRoster(fighters, rarityFilter, speciesFilter);
  if (!visible.length) return <p className="rounded-xl bg-[#fff8dc] p-4 text-sm">{emptyMessage}</p>;
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Choose a fighter">
    {visible.map((fighter) => <FighterCard key={fighter.id} fighter={fighter} compact={compact} selectable selected={selectedFighterId === fighter.id} disabled={disabled || Boolean(isFighterDisabled?.(fighter))} formationLabel={selectedFighterId === fighter.id ? formationLabel : undefined} onSelect={onSelect} />)}
  </div>;
}
