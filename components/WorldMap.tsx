"use client";
import type { MouseEvent } from "react";
import FarmerSprite from "@/components/FarmerSprite";
import { WORLD_CROP_SPRITES, WORLD_SPRITE_SHEETS } from "@/lib/sprite-data";
import { cellToWorld, displayedToWorld, worldToCell } from "@/lib/world-coordinates";
import type { WorldBuildingId, WorldDefinition, WorldPoint } from "@/lib/world-types";
import type { WorldMovementState } from "@/hooks/useWorldMovement";
import { crops } from "@/lib/game-data";
import { getSecondsRemaining, isReady } from "@/lib/farming";
import type { Plot } from "@/lib/game-types";

export default function WorldMap({ world, movement, moveTo, plots, now, onPlotClick, onBuildingClick, debug = false }: {
  world: WorldDefinition; movement: WorldMovementState; moveTo: (point: WorldPoint) => void;
  plots: Plot[]; now: number; onPlotClick: (id: number) => void;
  onBuildingClick: (id: WorldBuildingId) => void; debug?: boolean;
}) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = displayedToWorld(world, { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }, { x: event.clientX, y: event.clientY });
    moveTo(worldToCell(world, point));
  }
  const player = cellToWorld(world, movement.position);
  const sheet = WORLD_SPRITE_SHEETS.crops;
  return <div className="relative cursor-crosshair overflow-hidden" style={{ width: world.pixelWidth, height: world.pixelHeight, imageRendering: "pixelated", touchAction: "manipulation" }} onClick={handleClick} role="application" aria-label="Sprout Valley. Click or tap to walk; select a plot or building to interact.">
    {/* Native artwork, uniformly scaled by the viewport. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={world.background} width={world.pixelWidth} height={world.pixelHeight} alt="Sprout Village" draggable={false} className="pointer-events-none absolute inset-0 max-w-none select-none" style={{ imageRendering: "pixelated" }} />
    {world.farmPlots.map((cell) => {
      const plot = plots.find((entry) => entry.id === cell.id);
      const ready = plot ? isReady(plot, now) : false;
      const remaining = plot ? getSecondsRemaining(plot, now) : 0;
      const progress = plot?.crop && plot.plantedAt ? Math.max(0, (now - plot.plantedAt) / (crops[plot.crop].growTime * 1000)) : 0;
      const region = plot?.crop ? WORLD_CROP_SPRITES[plot.crop][ready ? "ready" : progress < 0.5 ? "early" : "growing"] : null;
      return <button key={cell.id} type="button" onClick={(event) => { event.stopPropagation(); onPlotClick(cell.id); }} className="absolute z-10 flex items-center justify-center rounded-sm border border-[#ffe28a]/40 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white" style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height }} aria-label={`Plot ${cell.id + 1}: ${plot?.crop ? `${crops[plot.crop].name}, ${ready ? "ready" : `${remaining}s remaining`}` : "empty"}`}>
        {region && <span className="pointer-events-none block" style={{ width: 32, height: 32, backgroundImage: `url("${sheet.src}")`, backgroundSize: "192px 192px", backgroundPosition: `${-region.x * 2}px ${-region.y * 2}px`, imageRendering: "pixelated" }} />}
        {ready && <span className="absolute -top-5 rounded bg-[#fff8dc] px-1 text-[10px] font-bold">READY</span>}
      </button>;
    })}
    {world.buildings.filter((b) => b.id === "seed-shop" || b.id === "dungeon" || b.id === "farmhouse" || b.id === "market").map((building) => <button key={building.id} type="button" aria-label={`Visit ${building.label}`} onClick={(event) => { event.stopPropagation(); onBuildingClick(building.id); }} className="absolute z-10 rounded-lg hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white" style={{ left: building.x, top: building.y, width: building.width, height: building.height }} />)}
    {process.env.NODE_ENV === "development" && debug && <div className="pointer-events-none absolute inset-0 z-20">
      {world.blocked.map((blocked, index) => <div key={index} className={`absolute border border-white/25 ${blocked ? "bg-red-600/45" : "bg-green-300/10"}`} style={{ left: index % world.width * world.pixelWidth / world.width, top: Math.floor(index / world.width) * world.pixelHeight / world.height, width: world.pixelWidth / world.width, height: world.pixelHeight / world.height }} />)}
      {world.buildings.map((b) => <div key={b.id} className="absolute text-xs font-bold text-white" style={{ left: b.entrance.x, top: b.entrance.y }}><span className="block h-3 w-3 rounded-full bg-cyan-300" />{b.label}</div>)}
      {world.farmPlots.map((p) => <div key={p.id} className="absolute border-2 border-yellow-300 text-xs text-white" style={{ left: p.x, top: p.y, width: p.width, height: p.height }}>{p.id + 1}</div>)}
    </div>}
    <div className="pointer-events-none absolute z-30" style={{ left: player.x, top: player.y }}><FarmerSprite frame={movement.frame} facing={movement.facing} moving={movement.moving} /></div>
  </div>;
}
