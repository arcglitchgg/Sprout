import { crops, mutations } from "@/lib/game-data";
import type { HarvestedCrop } from "@/lib/game-types";

export default function HarvestedCropCard({ item, actionLabel, actionDetail, actionDisabled = false, onAction, selected = false, onSelect }: {
  item: HarvestedCrop;
  actionLabel?: string;
  actionDetail?: string;
  actionDisabled?: boolean;
  onAction?: (itemId: string) => void;
  selected?: boolean;
  onSelect?: (itemId: string) => void;
}) {
  const selectable = Boolean(onSelect);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!selectable || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSelect?.(item.id);
  }

  return (
    <article
      className={`relative flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm ${selected ? "border-[#4f772d] bg-[#d9ed92] ring-2 ring-[#4f772d]/30" : "border-[#765438]/25 bg-[#fff8dc]"} ${selectable ? "cursor-pointer select-none hover:border-[#4f772d]/60" : ""}`}
      onClick={selectable ? () => onSelect?.(item.id) : undefined}
      onKeyDown={handleKeyDown}
      role={selectable ? "checkbox" : undefined}
      aria-checked={selectable ? selected : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      {selectable && <span className={`absolute right-2 top-2 flex size-5 items-center justify-center rounded-full border-2 text-xs font-black ${selected ? "border-[#4f772d] bg-[#4f772d] text-white" : "border-[#765438]/40 bg-white/70 text-transparent"}`} aria-hidden="true">✓</span>}
      <span className="text-3xl" aria-hidden="true">{crops[item.crop].emoji}</span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold">{mutations[item.mutation].label} {mutations[item.mutation].name} {crops[item.crop].name}</h3>
        <p className="text-xs text-[#65451f]">Sell value: <strong>🪙 {item.sellValue}</strong></p>
      </div>
      {actionLabel && onAction && (
        <div className="shrink-0 text-right">
          {actionDetail && <span className="mb-1 block text-[11px] font-bold text-[#65451f]">{actionDetail}</span>}
          <button type="button" onClick={() => onAction(item.id)} disabled={actionDisabled} className="rounded-lg bg-[#4f772d] px-3 py-2 text-xs font-bold text-white hover:bg-[#3e6421] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f772d]">
            {actionLabel}
          </button>
        </div>
      )}
    </article>
  );
}
