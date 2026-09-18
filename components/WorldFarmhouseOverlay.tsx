"use client";

import { useState } from "react";
import CollectionBook from "@/components/CollectionBook";
import FighterCard from "@/components/FighterCard";
import HarvestedCropCard from "@/components/HarvestedCropCard";
import type { CollectionEntry, Fighter, HarvestedCrop } from "@/lib/game-types";

type FarmhouseTab = "collection" | "fighters" | "harvested crops";

export default function WorldFarmhouseOverlay({
  collection,
  fighters,
  harvestedCrops,
  awakenCrop,
  onClose,
}: {
  collection: CollectionEntry[];
  fighters: Fighter[];
  harvestedCrops: HarvestedCrop[];
  awakenCrop: (itemId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FarmhouseTab>("collection");

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="farmhouse-title">
      <section className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#765438]/35 bg-[#d8b875] px-4 py-3">
          <div>
            <h2 id="farmhouse-title" className="text-xl font-bold sm:text-2xl">Farmhouse</h2>
            <p className="text-xs opacity-70 sm:text-sm">Your discoveries and awakened fighters.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f772d]" aria-label="Close Farmhouse">
            Close
          </button>
        </header>

        <div className="flex shrink-0 gap-2 border-b border-[#765438]/25 bg-[#e5cf98] px-3 pt-3" role="tablist" aria-label="Farmhouse sections">
          {(["collection", "fighters", "harvested crops"] as FarmhouseTab[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-t-lg px-4 py-2 text-sm font-bold capitalize ${tab === value ? "bg-[#fff8dc] text-[#2f3e2f]" : "bg-[#c8aa6a] text-[#493923] hover:bg-[#d4ba80]"}`}
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
