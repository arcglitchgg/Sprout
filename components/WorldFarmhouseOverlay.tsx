"use client";

import { useState } from "react";
import CollectionBook from "@/components/CollectionBook";
import FighterCard from "@/components/FighterCard";
import HarvestedCropCard from "@/components/HarvestedCropCard";
import { getFusionEligibility } from "@/lib/fusion";
import { crops, mutations } from "@/lib/game-data";
import type { CollectionEntry, Fighter, HarvestedCrop } from "@/lib/game-types";

type FarmhouseTab = "collection" | "fighters" | "harvested crops" | "fusion";

export default function WorldFarmhouseOverlay({
  collection,
  fighters,
  harvestedCrops,
  awakenCrop,
  fuseFighters,
  onClose,
}: {
  collection: CollectionEntry[];
  fighters: Fighter[];
  harvestedCrops: HarvestedCrop[];
  awakenCrop: (itemId: string) => void;
  fuseFighters: (selectedIds: string[]) => Fighter | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FarmhouseTab>("collection");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fusionResult, setFusionResult] = useState<Fighter | null>(null);
  const existingIds = new Set(fighters.map((fighter) => fighter.id));
  const selected = selectedIds.filter((id) => existingIds.has(id));
  const eligibility = getFusionEligibility(fighters, selected);
  const firstSelected = fighters.find((fighter) => fighter.id === selected[0]);

  function toggleFighter(id: string) {
    setFusionResult(null);
    setSelectedIds((current) => {
      const valid = current.filter((selectedId) => existingIds.has(selectedId));
      return valid.includes(id) ? valid.filter((selectedId) => selectedId !== id) : valid.length < 4 ? [...valid, id] : valid;
    });
  }

  function performFusion() {
    if (!eligibility.valid) return;
    const result = fuseFighters(selected);
    if (!result) return;
    setSelectedIds([]);
    setFusionResult(result);
  }

  function closeFarmhouse() {
    setSelectedIds([]);
    setFusionResult(null);
    onClose();
  }

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="farmhouse-title">
      <section className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#765438]/35 bg-[#d8b875] px-4 py-3">
          <div>
            <h2 id="farmhouse-title" className="text-xl font-bold sm:text-2xl">Farmhouse</h2>
            <p className="text-xs opacity-70 sm:text-sm">Your discoveries and awakened fighters.</p>
          </div>
          <button type="button" onClick={closeFarmhouse} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f772d]" aria-label="Close Farmhouse">
            Close
          </button>
        </header>

        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[#765438]/25 bg-[#e5cf98] px-3 pt-3" role="tablist" aria-label="Farmhouse sections">
          {(["collection", "fighters", "harvested crops", "fusion"] as FarmhouseTab[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`shrink-0 rounded-t-lg px-3 py-2 text-sm font-bold capitalize ${tab === value ? "bg-[#fff8dc] text-[#2f3e2f]" : "bg-[#c8aa6a] text-[#493923] hover:bg-[#d4ba80]"}`}
            >
              {value}{value === "fighters" ? ` (${fighters.length})` : value === "harvested crops" ? ` (${harvestedCrops.length})` : ""}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {tab === "collection" ? (
            <CollectionBook collection={collection} />
          ) : tab === "harvested crops" ? harvestedCrops.length === 0 ? (
            <div className="rounded-xl bg-[#fff8dc] p-5 text-sm opacity-70">Harvest crops before awakening them into fighters.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {harvestedCrops.map((item) => <HarvestedCropCard key={item.id} item={item} actionLabel="Awaken" onAction={awakenCrop} />)}
            </div>
          ) : tab === "fusion" ? (
            <div className="space-y-3">
              {fusionResult && (
                <div className="rounded-xl border-2 border-[#4f772d] bg-[#e6f3c8] p-3" role="status">
                  <h3 className="mb-2 font-bold">Fusion complete — new fighter</h3>
                  <FighterCard fighter={fusionResult} />
                </div>
              )}
              <div className="rounded-xl bg-[#fff8dc] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>Selected: {selected.length} / 4</strong>
                  <button type="button" onClick={() => setSelectedIds([])} disabled={selected.length === 0} className="rounded-lg border border-[#765438]/40 px-3 py-1 font-bold disabled:opacity-40">Clear</button>
                </div>
                <p className="mt-1">Choose four fighters of the same species and mutation. Golden and Prismatic cannot be fused yet.</p>
                {firstSelected && <p className="mt-2 font-bold">Species: {crops[firstSelected.crop].name} · Tier: {mutations[firstSelected.mutation].name}</p>}
                {firstSelected && (firstSelected.mutation === "normal" || firstSelected.mutation === "large") && (
                  <p className="mt-1 font-bold">Fusion Result: {firstSelected.mutation === "normal" ? "70% Normal · 30% Large" : "100% Large"}</p>
                )}
                <p className="mt-2 text-[#7b3e20]" role="status">{eligibility.valid ? "Ready to fuse four fighters." : eligibility.reason}</p>
                <button type="button" onClick={performFusion} disabled={!eligibility.valid} className="mt-3 w-full rounded-lg bg-[#4f772d] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Fuse Fighters</button>
              </div>
              {fighters.length === 0 ? <p className="rounded-xl bg-[#fff8dc] p-4 text-sm">Awaken fighters to use Fusion.</p> : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fighters.map((fighter) => {
                    const unavailable = fighter.mutation === "golden" || fighter.mutation === "prismatic";
                    const chosen = selected.includes(fighter.id);
                    return <button key={fighter.id} type="button" onClick={() => toggleFighter(fighter.id)} disabled={unavailable || (!chosen && selected.length === 4)} aria-pressed={chosen} className={`rounded-xl border-2 text-left disabled:cursor-not-allowed ${chosen ? "border-[#4f772d] bg-[#d9ed92]" : "border-transparent"} ${unavailable ? "opacity-55" : "hover:border-[#4f772d]/60"}`}>
                      <FighterCard fighter={fighter} />
                      <span className="block px-3 pb-2 text-xs font-bold">{unavailable ? "Fusion unavailable in V1" : chosen ? "✓ Selected" : "Select fighter"}</span>
                    </button>;
                  })}
                </div>
              )}
            </div>
          ) : fighters.length === 0 ? (
            <div className="rounded-xl bg-[#fff8dc] p-5 text-sm opacity-70">
              Awaken a harvested crop to create your first fighter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fighters.map((fighter) => <FighterCard key={fighter.id} fighter={fighter} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
