"use client";

import { useCallback, useEffect, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useSproutPersistence } from "@/hooks/useSproutPersistence";
import SeedSelector from "@/components/SeedSelector";
import Farm from "@/components/Farm";
import CollectionBook from "@/components/CollectionBook";
import FighterCard from "@/components/FighterCard";
import Battle from "@/components/Battle";
import PixelWorld from "@/components/PixelWorld";
import type { WorldNotification } from "@/components/WorldNotifications";
import { FIRST_WORLD } from "@/lib/world-data";
import type { SproutSavePayloadV3, SproutSaveV3 } from "@/lib/save-types";
import type { WorldPoint } from "@/lib/world-types";

export default function SproutGame() {
  const { hydration, scheduleSave } = useSproutPersistence();
  if (!hydration.complete) {
    return <main className="flex min-h-screen items-center justify-center bg-[#171c19] font-bold text-[#f4e8c1]">Loading Sprout Valley…</main>;
  }
  return <SproutGameSession initialSave={hydration.save} scheduleSave={scheduleSave} />;
}

function SproutGameSession({ initialSave, scheduleSave }: { initialSave: SproutSaveV3 | null; scheduleSave: (payload: SproutSavePayloadV3) => void }) {
  const [notifications, setNotifications] = useState<WorldNotification[]>([]);
  const notify = useCallback((notification: Omit<WorldNotification, "id">) => {
    setNotifications((current) => [...current, { ...notification, id: crypto.randomUUID() }]);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);
  const { coins, farmXp, farmLevel, unlockedPlotCount, selectedCrop, setSelectedCrop, seeds, buySeed, now, plots, collection, harvestedCrops, fighters, ascensionPity, handlePlotClick, harvestAll, sellCrops, awakenCrop, fuseFighters, awardBattleVictory } = useGame(initialSave?.game, notify);
  const [farmerWorld, setFarmerWorld] = useState(() => initialSave?.world ?? { farmerTile: { ...FIRST_WORLD.start }, facing: "right" as const });
  const [showLegacyPanels, setShowLegacyPanels] = useState(false);
  const handleFarmerSettled = useCallback((farmerTile: WorldPoint, facing: "left" | "right") => {
    setFarmerWorld({ farmerTile, facing });
  }, []);

  useEffect(() => {
    scheduleSave({
      game: { coins, farmXp, seeds, selectedCrop, plots, harvestedCrops, collection, fighters, ascensionPity },
      world: farmerWorld,
    });
  }, [coins, farmXp, seeds, selectedCrop, plots, harvestedCrops, collection, fighters, ascensionPity, farmerWorld, scheduleSave]);

  return (
    <main className="h-dvh overflow-hidden bg-[#171c19] p-2 text-[#2f3e2f] sm:p-3">
      <div className="mx-auto flex h-full max-w-6xl flex-col">
        <header className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-xl bg-[#252d27] px-3 py-2 text-[#f4e8c1] shadow sm:px-4">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Sprout 🌱</h1>
            <p className="hidden text-xs sm:block">
              Grow. Collect. Mutate. Fight.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {process.env.NODE_ENV === "development" && (
              <button type="button" onClick={() => setShowLegacyPanels(true)} className="rounded-lg border border-white/20 px-2 py-1 text-xs font-bold text-[#f4e8c1] hover:bg-white/10">
                Debug panels
              </button>
            )}
            <div className="rounded-lg bg-[#ffe28a] px-3 py-1.5 font-black tabular-nums text-[#4a2c12]">
              🪙 {coins}
            </div>
            <div className="rounded-lg bg-[#d9ed92] px-3 py-1.5 text-xs font-black tabular-nums text-[#304719] sm:text-sm">
              Farm Lv {farmLevel} · {farmXp} XP
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <PixelWorld coins={coins} unlockedPlotCount={unlockedPlotCount} plots={plots} now={now} selectedCrop={selectedCrop} setSelectedCrop={setSelectedCrop} seeds={seeds} buySeed={buySeed} handlePlotClick={handlePlotClick} harvestAll={harvestAll} fighters={fighters} ascensionPity={ascensionPity} collection={collection} harvestedCrops={harvestedCrops} sellCrops={sellCrops} awakenCrop={awakenCrop} fuseFighters={fuseFighters} awardBattleVictory={awardBattleVictory} notifications={notifications} notify={notify} onDismissNotification={dismissNotification} initialFarmerTile={farmerWorld.farmerTile} initialFarmerFacing={farmerWorld.facing} onFarmerSettled={handleFarmerSettled} />
        </div>

        {process.env.NODE_ENV === "development" && showLegacyPanels && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#171c19]/95 p-3 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center gap-3 text-[#d6dbd2]">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Legacy game panels</span>
            <button type="button" onClick={() => setShowLegacyPanels(false)} className="rounded-lg bg-[#f4e8c1] px-3 py-1 text-sm font-bold text-[#2f3e2f]">Close</button>
          </div>

          <SeedSelector selectedCrop={selectedCrop} setSelectedCrop={setSelectedCrop} seeds={seeds} />

        <Farm plots={plots} unlockedPlotCount={unlockedPlotCount} now={now} selectedCrop={selectedCrop} seeds={seeds} handlePlotClick={handlePlotClick} />

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
        )}
      </div>
    </main>
  );
}
