import FarmerSprite from "@/components/FarmerSprite";
import { FARMER_ANIMATION } from "@/lib/sprite-data";
import type { WorldPlayer } from "@/lib/social-types";

export default function WorldPlayerEntity({ player, onInteract, labelScale = 1 }: { player: WorldPlayer; onInteract?: (player: WorldPlayer) => void; labelScale?: number }) {
  return <div className="pointer-events-none absolute z-30" style={{ left: player.x, top: player.y }}>
    <FarmerSprite frame={player.frame ?? FARMER_ANIMATION.idleFrame} facing={player.facing} moving={player.moving ?? false} />
    <span className="absolute bottom-[68px] left-0 max-w-40 origin-bottom truncate rounded-md border border-white/30 bg-[#172219]/90 px-2 py-1 text-center text-[15px] font-bold leading-tight text-[#fff8dc] shadow" style={{ transform: `translateX(-50%) scale(${labelScale})` }} title={player.displayName}>
      {player.isOwner ? "★ " : ""}{player.displayName}
    </span>
    {!player.isLocal && onInteract && <button type="button" aria-label={`Talk to ${player.displayName}`} onClick={(event) => { event.stopPropagation(); onInteract(player); }} className="pointer-events-auto absolute bottom-0 left-0 h-[76px] w-16 -translate-x-1/2 rounded-lg focus-visible:ring-2 focus-visible:ring-white" />}
  </div>;
}
