"use client";

import { useEffect, useRef, useState } from "react";
import WorldMap from "@/components/WorldMap";
import WorldSeedShopPanel from "@/components/WorldSeedShopPanel";
import WorldDungeonOverlay from "@/components/WorldDungeonOverlay";
import WorldFarmhouseOverlay from "@/components/WorldFarmhouseOverlay";
import WorldMarketOverlay from "@/components/WorldMarketOverlay";
import { useWorldMovement } from "@/hooks/useWorldMovement";
import { FIRST_WORLD } from "@/lib/world-data";
import { findPath } from "@/lib/pathfinding";
import { worldToCell } from "@/lib/world-coordinates";
import { crops } from "@/lib/game-data";
import { getSecondsRemaining, isReady } from "@/lib/farming";
import type { CollectionEntry, CropType, Fighter, HarvestedCrop, Plot, SeedInventory } from "@/lib/game-types";
import type { BattleState } from "@/lib/battle-types";
import type { WorldBuildingId } from "@/lib/world-types";
import type { WorldPoint } from "@/lib/world-types";

const WORLD_PIXEL_WIDTH = FIRST_WORLD.pixelWidth;
const WORLD_PIXEL_HEIGHT = FIRST_WORLD.pixelHeight;

type Props = {
  coins: number;
  plots: Plot[];
  now: number;
  selectedCrop: CropType;
  setSelectedCrop: (crop: CropType) => void;
  seeds: SeedInventory;
  buySeed: (crop: CropType) => void;
  handlePlotClick: (plot: Plot, clickedAt: number) => string | null;
  fighters: Fighter[];
  collection: CollectionEntry[];
  harvestedCrops: HarvestedCrop[];
  sellCrops: (itemIds: string[]) => void;
  awakenCrop: (itemId: string) => void;
  awardBattleVictory: (result: BattleState) => void;
  initialFarmerTile?: WorldPoint;
  initialFarmerFacing?: "left" | "right";
  onFarmerSettled: (tile: WorldPoint, facing: "left" | "right") => void;
};

export default function PixelWorld({ coins, plots, now, selectedCrop, setSelectedCrop, seeds, buySeed, handlePlotClick, fighters, collection, harvestedCrops, sellCrops, awakenCrop, awardBattleVictory, initialFarmerTile, initialFarmerFacing, onFarmerSettled }: Props) {
  const { state, moveTo, cancelInteraction } = useWorldMovement(FIRST_WORLD, { initialTile: initialFarmerTile, initialFacing: initialFarmerFacing, onSettled: onFarmerSettled });
  const viewportRef = useRef<HTMLDivElement>(null);
  const plotsRef = useRef(plots);
  const handlePlotClickRef = useRef(handlePlotClick);
  const [scale, setScale] = useState(1);
  const [plantingPlotId, setPlantingPlotId] = useState<number | null>(null);
  const [growingPlotId, setGrowingPlotId] = useState<number | null>(null);
  const [worldMessage, setWorldMessage] = useState<string | null>(null);
  const [seedShopOpen, setSeedShopOpen] = useState(false);
  const [dungeonOpen, setDungeonOpen] = useState(false);
  const [farmhouseOpen, setFarmhouseOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const toggle = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === "KeyG") {
        event.preventDefault();
        setDebug((value) => !value);
      }
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  useEffect(() => {
    plotsRef.current = plots;
    handlePlotClickRef.current = handlePlotClick;
  }, [plots, handlePlotClick]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const nextScale = Math.min(
        entry.contentRect.width / WORLD_PIXEL_WIDTH,
        entry.contentRect.height / WORLD_PIXEL_HEIGHT,
      );
      if (Number.isFinite(nextScale) && nextScale > 0) setScale(nextScale);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  function closeInteraction() {
    cancelInteraction();
    setPlantingPlotId(null);
    setGrowingPlotId(null);
    setWorldMessage(null);
    setSeedShopOpen(false);
    setFarmhouseOpen(false);
    setMarketOpen(false);
  }

  function arriveAtPlot(plotId: number) {
    const plot = plotsRef.current.find((entry) => entry.id === plotId);
    if (!plot) return;
    const arrivedAt = Date.now();
    if (!plot.crop) {
      setPlantingPlotId(plotId);
      return;
    }
    if (isReady(plot, arrivedAt)) {
      handlePlotClickRef.current(plot, arrivedAt);
      return;
    }
    setGrowingPlotId(plotId);
  }

  function selectPlot(plotId: number) {
    if (farmhouseOpen || marketOpen) return;
    closeInteraction();
    const worldPlot = FIRST_WORLD.farmPlots.find((plot) => plot.id === plotId);
    if (!worldPlot) return;
    const destination = worldToCell(FIRST_WORLD, worldPlot.approach);
    const route = findPath(FIRST_WORLD.blocked, FIRST_WORLD.width, FIRST_WORLD.height, state.tile, destination);
    if (!route.length) {
      setWorldMessage("That plot cannot be reached.");
      return;
    }
    moveTo(destination, () => arriveAtPlot(plotId));
  }

  function moveInWorld(destination: { x: number; y: number }) {
    if (farmhouseOpen || marketOpen) return;
    closeInteraction();
    moveTo(destination);
  }

  function selectBuilding(buildingId: WorldBuildingId) {
    if (farmhouseOpen || marketOpen) return;
    closeInteraction();
    const building = FIRST_WORLD.buildings.find((entry) => entry.id === buildingId);
    if (!building || (buildingId !== "seed-shop" && buildingId !== "dungeon" && buildingId !== "farmhouse" && buildingId !== "market")) return;
    const entrance = worldToCell(FIRST_WORLD, building.entrance);
    const path = findPath(FIRST_WORLD.blocked, FIRST_WORLD.width, FIRST_WORLD.height, state.tile, entrance);
    if (!path.length) {
      setWorldMessage(`${building.label} cannot be reached.`);
      return;
    }
    moveTo(entrance, () => {
      if (buildingId === "seed-shop") setSeedShopOpen(true);
      if (buildingId === "dungeon") setDungeonOpen(true);
      if (buildingId === "farmhouse") setFarmhouseOpen(true);
      if (buildingId === "market") setMarketOpen(true);
    });
  }

  function plantSelectedCrop() {
    if (plantingPlotId === null) return;
    const plot = plotsRef.current.find((entry) => entry.id === plantingPlotId);
    if (!plot) return;
    const message = handlePlotClickRef.current(plot, Date.now());
    if (message) {
      setWorldMessage(message);
      return;
    }
    setPlantingPlotId(null);
  }

  const plantingPlot = plantingPlotId === null ? null : plots.find((plot) => plot.id === plantingPlotId);
  const growingPlot = growingPlotId === null ? null : plots.find((plot) => plot.id === growingPlotId);

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2 px-1 text-[#e8eadf]">
        <div>
          <h2 className="text-base font-bold sm:text-lg">Sprout Valley</h2>
          <p className="hidden text-xs text-[#b9c1b9] sm:block">Click or tap to walk. Visit the Seed Store, tend the highlighted plots, or enter the Dungeon.</p>
        </div>
      </div>
      <div ref={viewportRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#101512] p-1 sm:p-2">
        <div className="relative shrink-0" style={{ width: WORLD_PIXEL_WIDTH * scale, height: WORLD_PIXEL_HEIGHT * scale }}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: WORLD_PIXEL_WIDTH, height: WORLD_PIXEL_HEIGHT, transform: `scale(${scale})`, imageRendering: "pixelated" }}>
            <WorldMap world={FIRST_WORLD} movement={state} moveTo={moveInWorld} plots={plots} now={now} onPlotClick={selectPlot} onBuildingClick={selectBuilding} debug={debug} />
          </div>
        </div>
      </div>

      {plantingPlot && !plantingPlot.crop && (
        <div className="absolute bottom-5 left-1/2 z-50 w-[min(92%,420px)] -translate-x-1/2 rounded-xl border-2 border-[#765438] bg-[#fff8dc] p-3 text-[#2f3e2f] shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <strong>Plant Plot {plantingPlot.id + 1}</strong>
            <button type="button" onClick={closeInteraction} className="rounded px-2 font-bold" aria-label="Close planting panel">×</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(crops) as CropType[]).map((cropKey) => (
              <button key={cropKey} type="button" disabled={seeds[cropKey] === 0} onClick={() => setSelectedCrop(cropKey)} className={`rounded-lg border-2 p-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${selectedCrop === cropKey ? "border-[#4f772d] bg-[#d9ed92]" : "border-transparent bg-white/60"}`}>
                <span className="block text-xl">{crops[cropKey].emoji}</span>
                {crops[cropKey].name} · Owned: {seeds[cropKey]}
              </button>
            ))}
          </div>
          {seeds[selectedCrop] === 0 && <p className="mt-3 text-center text-sm font-bold text-[#8a351f]">No {crops[selectedCrop].name} seeds — visit the Seed Store.</p>}
          <button type="button" onClick={plantSelectedCrop} disabled={seeds[selectedCrop] === 0} className="mt-3 w-full rounded-lg bg-[#4f772d] px-3 py-2 font-bold text-white disabled:opacity-40">
            Plant {crops[selectedCrop].name}
          </button>
        </div>
      )}

      {growingPlot?.crop && (
        <div className="absolute bottom-5 left-1/2 z-50 flex w-[min(92%,360px)] -translate-x-1/2 items-center justify-between rounded-xl border-2 border-[#765438] bg-[#fff8dc] p-3 text-sm text-[#2f3e2f] shadow-xl">
          <span><strong>{crops[growingPlot.crop].name}</strong> · {isReady(growingPlot, now) ? "Ready — click the plot again" : `${getSecondsRemaining(growingPlot, now)}s remaining`}</span>
          <button type="button" onClick={closeInteraction} className="rounded px-2 font-bold" aria-label="Close crop status">×</button>
        </div>
      )}

      {worldMessage && <div className="absolute bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#fff8dc] px-4 py-2 text-sm font-bold text-[#2f3e2f] shadow-xl">{worldMessage}</div>}

      {seedShopOpen && <WorldSeedShopPanel coins={coins} seeds={seeds} buySeed={buySeed} onClose={() => setSeedShopOpen(false)} />}
      {dungeonOpen && <WorldDungeonOverlay fighters={fighters} onVictory={awardBattleVictory} onClose={() => setDungeonOpen(false)} />}
      {farmhouseOpen && <WorldFarmhouseOverlay collection={collection} fighters={fighters} harvestedCrops={harvestedCrops} awakenCrop={awakenCrop} onClose={() => setFarmhouseOpen(false)} />}
      {marketOpen && <WorldMarketOverlay coins={coins} harvestedCrops={harvestedCrops} sellCrops={sellCrops} onClose={() => setMarketOpen(false)} />}
    </section>
  );
}
