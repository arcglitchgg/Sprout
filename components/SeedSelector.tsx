import { crops } from "@/lib/game-data";
import type { CropType, SeedInventory } from "@/lib/game-types";

export default function SeedSelector({ selectedCrop, setSelectedCrop, seeds }: { selectedCrop: CropType; setSelectedCrop: (crop: CropType) => void; seeds: SeedInventory }) {
  return (
    <section className="mb-6 rounded-2xl bg-[#f4e8c1] p-4">
      <h2 className="mb-3 text-lg font-bold">Choose Owned Seed</h2>
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(crops) as CropType[]).map((cropKey) => {
          const crop = crops[cropKey];
          return (
            <button key={cropKey} disabled={seeds[cropKey] === 0} onClick={() => setSelectedCrop(cropKey)} className={`rounded-xl border-4 p-3 transition disabled:cursor-not-allowed disabled:opacity-45 ${selectedCrop === cropKey ? "border-[#4f772d] bg-[#d9ed92]" : "border-transparent bg-[#fff8dc]"}`}>
              <div className="text-3xl">{crop.emoji}</div><div className="font-bold">{crop.name}</div>
              <div className="text-xs font-bold">Owned: {seeds[cropKey]}</div><div className="text-xs">Base Sell: 🪙 {crop.sellPrice}</div><div className="text-xs">Grow: {crop.growTime}s</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
