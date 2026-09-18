"use client";

import { useState } from "react";
import { crops } from "@/lib/game-data";
import { getSecondsRemaining, isReady } from "@/lib/farming";
import type { CropType, Plot, SeedInventory } from "@/lib/game-types";

export default function Farm({ plots, unlockedPlotCount, now, selectedCrop, seeds, handlePlotClick }: { plots: Plot[]; unlockedPlotCount: number; now: number; selectedCrop: CropType; seeds: SeedInventory; handlePlotClick: (plot: Plot, clickedAt: number) => string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="rounded-3xl bg-[#a7c77d] p-6 shadow-inner">
      <p className="mb-3 text-sm font-bold">Selected: {crops[selectedCrop].name} · Owned: {seeds[selectedCrop]}</p>
      {message && <p className="mb-3 rounded-lg bg-[#fff8dc] px-3 py-2 text-sm font-bold text-[#6b321c]">{message}</p>}
      <div className="grid grid-cols-3 gap-4">
        {plots.slice(0, unlockedPlotCount).map((plot) => {
          const ready = isReady(plot, now);
          const remaining = getSecondsRemaining(plot, now);
          return (
            <button key={plot.id} onClick={() => setMessage(handlePlotClick(plot, Date.now()))} className={`aspect-square rounded-2xl border-4 border-[#7b5e3b] bg-[#8b5a2b] p-2 transition ${ready ? "hover:scale-105" : ""}`}>
              {!plot.crop && <div className="text-4xl">🟫</div>}
              {plot.crop && <div className="flex h-full flex-col items-center justify-center"><div className="text-5xl">{ready ? crops[plot.crop].emoji : "🌱"}</div><div className="mt-2 rounded-lg bg-black/30 px-2 py-1 text-xs font-bold text-white">{ready ? "READY!" : `${remaining}s`}</div></div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
