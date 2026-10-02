"use client";

import { useState } from "react";
import HarvestedCropCard from "@/components/HarvestedCropCard";
import { clearMarketSelection, filterMarketCrops, getMarketSelectAllLabel, selectVisibleMarketCrops, summarizeMarketSelection, toggleMarketSelection } from "@/lib/market";
import type { MarketMutationFilter, MarketSpeciesFilter } from "@/lib/market";
import type { CropType, HarvestedCrop, HarvestMutationType } from "@/lib/game-types";

const MUTATION_FILTERS: MarketMutationFilter[] = ["all", "normal", "large", "golden", "prismatic"];
const SPECIES_FILTERS: MarketSpeciesFilter[] = ["all", "potato", "carrot", "corn"];
const FILTER_LABELS: Record<"all" | CropType | HarvestMutationType, string> = { all: "All", normal: "Normal", large: "Large", golden: "Golden", prismatic: "Prismatic", potato: "Potato", carrot: "Carrot", corn: "Corn" };

export default function WorldMarketOverlay({ coins, harvestedCrops, sellCrops, onClose }: {
  coins: number;
  harvestedCrops: HarvestedCrop[];
  sellCrops: (itemIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingRareSale, setConfirmingRareSale] = useState(false);
  const [mutationFilter, setMutationFilter] = useState<MarketMutationFilter>("all");
  const [speciesFilter, setSpeciesFilter] = useState<MarketSpeciesFilter>("all");
  const summary = summarizeMarketSelection(harvestedCrops, selectedIds);
  const visibleCrops = filterMarketCrops(harvestedCrops, mutationFilter, speciesFilter);
  const selectAllLabel = getMarketSelectAllLabel(mutationFilter, speciesFilter);

  function replaceSelection(ids: string[]) {
    setSelectedIds(ids);
    setConfirmingRareSale(false);
  }

  function completeSale() {
    sellCrops(selectedIds);
    replaceSelection([]);
  }

  function requestSale() {
    if (!summary.count) return;
    if (summary.requiresConfirmation) {
      setConfirmingRareSale(true);
      return;
    }
    completeSale();
  }

  function closeMarket() {
    replaceSelection([]);
    onClose();
  }

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="market-title">
      <section className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#765438]/35 bg-[#d8b875] px-3 py-2 sm:px-4 sm:py-3">
          <div>
            <h2 id="market-title" className="text-xl font-bold sm:text-2xl">Market</h2>
            <p className="text-xs opacity-70">Inventory: {harvestedCrops.length} · Selected: {summary.count}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#ffe28a] px-3 py-2 font-black tabular-nums text-[#4a2c12]">🪙 {coins}</span>
            <button type="button" onClick={closeMarket} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold shadow-sm" aria-label="Close Market">Close</button>
          </div>
        </header>

        {harvestedCrops.length > 0 && (
          <div className="shrink-0 space-y-2 border-b border-[#765438]/25 bg-[#e5cf98] px-3 py-2">
            <div className="flex flex-wrap gap-1.5" aria-label="Mutation filter">{MUTATION_FILTERS.map((value) => <button key={value} type="button" aria-pressed={mutationFilter === value} onClick={() => setMutationFilter(value)} className={`rounded-full px-2.5 py-1 text-xs font-bold ${mutationFilter === value ? "bg-[#4f772d] text-white" : "bg-[#fff8dc]"}`}>{FILTER_LABELS[value]}</button>)}</div>
            <div className="flex flex-wrap gap-1.5" aria-label="Crop species filter">{SPECIES_FILTERS.map((value) => <button key={value} type="button" aria-pressed={speciesFilter === value} onClick={() => setSpeciesFilter(value)} className={`rounded-full px-2.5 py-1 text-xs font-bold ${speciesFilter === value ? "bg-[#765438] text-white" : "bg-[#fff8dc]"}`}>{value === "all" ? "All Crops" : FILTER_LABELS[value]}</button>)}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => replaceSelection(selectVisibleMarketCrops(harvestedCrops, selectedIds, mutationFilter, speciesFilter))} disabled={!visibleCrops.length} className="rounded-lg bg-[#fff8dc] px-3 py-1.5 text-xs font-bold disabled:opacity-40">{selectAllLabel}</button>
              {summary.count > 0 && <button type="button" onClick={() => replaceSelection(clearMarketSelection())} className="rounded-lg bg-[#fff8dc] px-3 py-1.5 text-xs font-bold">Clear Selection</button>}
              <span className="text-sm font-black tabular-nums sm:ml-auto">Selected: {summary.count} · 🪙 {summary.total}</span>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {harvestedCrops.length === 0 ? (
            <div className="rounded-xl bg-[#fff8dc] p-5 text-center text-sm opacity-70">Harvested crops will appear here when they are ready to sell.</div>
          ) : (
            visibleCrops.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibleCrops.map((item) => (
                <HarvestedCropCard key={item.id} item={item} selected={selectedIds.includes(item.id)} onSelect={(itemId) => replaceSelection(toggleMarketSelection(selectedIds, itemId))} />
              ))}
            </div> : <div className="rounded-xl bg-[#fff8dc] p-5 text-center text-sm opacity-70">No harvested crops match these filters.</div>
          )}
        </div>

        <footer className="shrink-0 border-t border-[#765438]/25 bg-[#e5cf98] p-3">
          {confirmingRareSale ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#a45b27] bg-[#fff0c7] p-2">
              <p className="text-sm font-bold text-[#713916]">This sale includes Golden or Prismatic crops. Sell them for 🪙 {summary.total}?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmingRareSale(false)} className="rounded-lg bg-[#fff8dc] px-3 py-2 text-sm font-bold">Cancel</button>
                <button type="button" onClick={completeSale} className="rounded-lg bg-[#9b3d25] px-3 py-2 text-sm font-bold text-white">Confirm Sale</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={requestSale} disabled={!summary.count} className="w-full rounded-lg bg-[#4f772d] px-4 py-2.5 font-bold text-white hover:bg-[#3e6421] disabled:cursor-not-allowed disabled:opacity-40">
              Sell Selected · 🪙 {summary.total}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
