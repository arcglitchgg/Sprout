import { crops, mutations } from "@/lib/game-data";
import type { HarvestedCrop } from "@/lib/game-types";

export default function HarvestedCropCard({ item, actionLabel, onAction }: {
  item: HarvestedCrop;
  actionLabel: string;
  onAction: (itemId: string) => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-[#765438]/25 bg-[#fff8dc] p-3 shadow-sm">
      <span className="text-3xl" aria-hidden="true">{crops[item.crop].emoji}</span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold">{mutations[item.mutation].label} {mutations[item.mutation].name} {crops[item.crop].name}</h3>
        <p className="text-xs text-[#65451f]">Sell value: <strong>🪙 {item.sellValue}</strong></p>
      </div>
      <button type="button" onClick={() => onAction(item.id)} className="shrink-0 rounded-lg bg-[#4f772d] px-3 py-2 text-xs font-bold text-white hover:bg-[#3e6421] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f772d]">
        {actionLabel}
      </button>
    </article>
  );
}
