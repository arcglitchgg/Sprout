"use client";

import HarvestedCropCard from "@/components/HarvestedCropCard";
import type { HarvestedCrop } from "@/lib/game-types";

export default function WorldMarketOverlay({ coins, harvestedCrops, sellCrop, onClose }: {
  coins: number;
  harvestedCrops: HarvestedCrop[];
  sellCrop: (itemId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="market-title">
      <section className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#765438]/35 bg-[#d8b875] px-4 py-3">
          <div>
            <h2 id="market-title" className="text-xl font-bold sm:text-2xl">Market</h2>
            <p className="text-xs opacity-70 sm:text-sm">Sell harvested crops for coins.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#ffe28a] px-3 py-2 font-black tabular-nums text-[#4a2c12]">🪙 {coins}</span>
            <button type="button" onClick={onClose} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold shadow-sm" aria-label="Close Market">Close</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {harvestedCrops.length === 0 ? (
            <div className="rounded-xl bg-[#fff8dc] p-5 text-center text-sm opacity-70">Harvested crops will appear here when they are ready to sell.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {harvestedCrops.map((item) => <HarvestedCropCard key={item.id} item={item} actionLabel="Sell" onAction={sellCrop} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
