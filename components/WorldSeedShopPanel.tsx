import { crops } from "@/lib/game-data";
import type { CropType, SeedInventory } from "@/lib/game-types";

export default function WorldSeedShopPanel({ coins, seeds, buySeed, onClose }: {
  coins: number;
  seeds: SeedInventory;
  buySeed: (crop: CropType, quantity?: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-5 left-1/2 z-50 w-[min(94%,540px)] -translate-x-1/2 rounded-xl border-2 border-[#765438] bg-[#fff8dc] p-4 text-[#2f3e2f] shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="font-bold">Seed Shop</h3><p className="text-xs opacity-70">Buy seeds to plant on your farm.</p></div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#ffe28a] px-2 py-1 font-black tabular-nums text-[#4a2c12]">🪙 {coins}</span>
          <button type="button" onClick={onClose} className="rounded px-2 font-bold" aria-label="Close Seed Shop">×</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(crops) as CropType[]).map((cropKey) => {
          const crop = crops[cropKey];
          return (
            <div key={cropKey} className="rounded-lg border-2 border-transparent bg-white/60 p-2 text-center text-xs">
              <span className="block text-2xl">{crop.emoji}</span><strong className="block">{crop.name}</strong>
              <span className="block">Seed: 🪙 {crop.cost}</span><span className="block">Grow: {crop.growTime}s</span>
              <span className="block">Base sell: 🪙 {crop.sellPrice}</span><span className="mt-1 block font-bold">Owned: {seeds[cropKey]}</span>
              <div className="mt-2 grid gap-1">
                {[1, 50, 100].map((quantity) => {
                  const total = crop.cost * quantity;
                  return <button key={quantity} type="button" onClick={() => buySeed(cropKey, quantity)} disabled={coins < total} title={`Costs ${total} coins`} className="w-full rounded-md bg-[#4f772d] px-2 py-1.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Buy {quantity} · {total}</button>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg bg-[#4f772d] px-3 py-2 text-sm font-bold text-white">Done</button>
    </div>
  );
}
