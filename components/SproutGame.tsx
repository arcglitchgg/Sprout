"use client";

import { useCallback, useEffect, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useSproutPersistence } from "@/hooks/useSproutPersistence";
import { crops, mutations } from "@/lib/game-data";
import SeedSelector from "@/components/SeedSelector";
import Farm from "@/components/Farm";
import CollectionBook from "@/components/CollectionBook";
import FighterCard from "@/components/FighterCard";
import Battle from "@/components/Battle";
import PixelWorld from "@/components/PixelWorld";
import { FIRST_WORLD } from "@/lib/world-data";
import type { SproutSavePayloadV1, SproutSaveV1 } from "@/lib/save-types";
import type { WorldPoint } from "@/lib/world-types";

export default function SproutGame() {
  const { hydration, scheduleSave } = useSproutPersistence();
  if (!hydration.complete) {
    return <main className="flex min-h-screen items-center justify-center bg-[#171c19] font-bold text-[#f4e8c1]">Loading Sprout Valley…</main>;
  }
  return <SproutGameSession initialSave={hydration.save} scheduleSave={scheduleSave} />;
}

function SproutGameSession({ initialSave, scheduleSave }: { initialSave: SproutSaveV1 | null; scheduleSave: (payload: SproutSavePayloadV1) => void }) {
  const { coins, selectedCrop, setSelectedCrop, seeds, buySeed, now, plots, collection, lastHarvest, harvestedCrops, fighters, handlePlotClick, sellCrop, awakenCrop, awardBattleVictory } = useGame(initialSave?.game);
  const [farmerWorld, setFarmerWorld] = useState(() => initialSave?.world ?? { farmerTile: { ...FIRST_WORLD.start }, facing: "right" as const });
  const handleFarmerSettled = useCallback((farmerTile: WorldPoint, facing: "left" | "right") => {
    setFarmerWorld({ farmerTile, facing });
  }, []);

  useEffect(() => {
    scheduleSave({
      game: { coins, seeds, selectedCrop, plots, harvestedCrops, collection, fighters },
      world: farmerWorld,
    });
  }, [coins, seeds, selectedCrop, plots, harvestedCrops, collection, fighters, farmerWorld, scheduleSave]);

  return (
    <main className="min-h-screen bg-[#171c19] p-3 text-[#2f3e2f] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl bg-[#252d27] p-4 text-[#f4e8c1] shadow">
          <div>
            <h1 className="text-3xl font-bold">Sprout 🌱</h1>
            <p className="text-sm">
              Grow. Collect. Mutate. Fight.
            </p>
          </div>

          <div className="rounded-xl bg-[#ffe28a] px-4 py-2 font-black tabular-nums text-[#4a2c12]">
            🪙 {coins}
          </div>
        </header>

        {lastHarvest && (
          <section className="mb-6 rounded-2xl bg-[#fff8dc] p-4 shadow">
            <div className="text-sm font-bold">
              {lastHarvest.newDiscovery &&
                "✨ NEW DISCOVERY! "}
              {mutations[lastHarvest.mutation].label}{" "}
              {mutations[lastHarvest.mutation].name}{" "}
              {crops[lastHarvest.crop].emoji}{" "}
              {crops[lastHarvest.crop].name}
            </div>

            <div className="mt-1 text-sm">
              Worth 🪙 {lastHarvest.value}
            </div>
          </section>
        )}

        <PixelWorld coins={coins} plots={plots} now={now} selectedCrop={selectedCrop} setSelectedCrop={setSelectedCrop} seeds={seeds} buySeed={buySeed} handlePlotClick={handlePlotClick} fighters={fighters} collection={collection} harvestedCrops={harvestedCrops} sellCrop={sellCrop} awakenCrop={awakenCrop} awardBattleVictory={awardBattleVictory} initialFarmerTile={farmerWorld.farmerTile} initialFarmerFacing={farmerWorld.facing} onFarmerSettled={handleFarmerSettled} />

        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center gap-3 text-[#d6dbd2]">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Legacy game panels</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>

          <SeedSelector selectedCrop={selectedCrop} setSelectedCrop={setSelectedCrop} seeds={seeds} />

        <Farm plots={plots} now={now} selectedCrop={selectedCrop} seeds={seeds} handlePlotClick={handlePlotClick} />

        <CollectionBook collection={collection} />

        <section className="mt-6 rounded-2xl bg-[#f4e8c1] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              Fighters ⚔️
            </h2>

            <span className="text-sm font-bold">
              {fighters.length}
            </span>
          </div>

          {fighters.length === 0 ? (
            <p className="text-sm opacity-60">
              Awaken a harvested crop to create
              your first fighter.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fighters.map((fighter) => (
                <FighterCard key={fighter.id} fighter={fighter} />
              ))}
            </div>
          )}
        </section>
          <Battle fighters={fighters} onVictory={awardBattleVictory} />
        </div>
      </div>
    </main>
  );
}
