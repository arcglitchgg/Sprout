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
import MainMenu from "@/components/MainMenu";
import type { WorldNotification } from "@/components/WorldNotifications";
import { FIRST_WORLD } from "@/lib/world-data";
import type { SproutSavePayloadV3, SproutSaveV3 } from "@/lib/save-types";
import type { WorldPoint } from "@/lib/world-types";
import type { GuideTopicId } from "@/lib/guide-data";

export default function SproutGame() {
  const { hydration, scheduleSave, syncState } = useSproutPersistence();
  if (!hydration.complete) {
    return <main className="flex min-h-screen items-center justify-center bg-[#171c19] font-bold text-[#f4e8c1]">Loading Sprout Valley…</main>;
  }
  return <SproutGameSession initialSave={hydration.save} scheduleSave={scheduleSave} syncState={syncState} />;
}

function SproutGameSession({ initialSave, scheduleSave, syncState }: { initialSave: SproutSaveV3 | null; scheduleSave: (payload: SproutSavePayloadV3) => void; syncState: ReturnType<typeof useSproutPersistence>["syncState"] }) {
  const [notifications, setNotifications] = useState<WorldNotification[]>([]);
  const notify = useCallback((notification: Omit<WorldNotification, "id">) => {
    setNotifications((current) => [...current, { ...notification, id: crypto.randomUUID() }]);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);
  const { coins, farmXp, farmLevel, unlockedPlotCount, selectedCrop, setSelectedCrop, seeds, buySeed, now, plots, collection, harvestedCrops, fighters, activeTeam, teamPresets, defaultTeamPreset, ascendantShards, ascensionPity, dungeon, handlePlotClick, harvestAll, sellCrops, awakenCrop, fuseFighters, setFighterLocked, setFighterFavorite, renameFighter, releaseFighter, dismantleFighter, setTeamPreset, renameTeamPreset, setDefaultTeamPreset, awardDungeonVictory } = useGame(initialSave?.game, notify);
  const [farmerWorld, setFarmerWorld] = useState(() => initialSave?.world ?? { farmerTile: { ...FIRST_WORLD.start }, facing: "right" as const });
  const [showLegacyPanels, setShowLegacyPanels] = useState(false);
  const [menuGuide, setMenuGuide] = useState<GuideTopicId | null | undefined>(undefined);
  const handleFarmerSettled = useCallback((farmerTile: WorldPoint, facing: "left" | "right") => {
    setFarmerWorld({ farmerTile, facing });
  }, []);
  const saveLabel = syncState === "saved" ? "Saved" : syncState === "saving" ? "Saving..." : syncState === "local-only" ? "Local only" : syncState === "conflict" ? "Conflict" : syncState === "local-failed" ? "Local save failed" : "Cloud save failed";
  const saveWarning = syncState === "conflict" ? "Cloud save conflict — newer local progress is preserved on this device." : syncState === "local-failed" ? "Local save failed — progress durability is not guaranteed." : syncState === "cloud-failed" ? "Cloud save failed — progress is currently stored locally." : null;

  useEffect(() => {
    scheduleSave({
      game: { coins, farmXp, seeds, selectedCrop, plots, harvestedCrops, collection, fighters, activeTeam, teamPresets, defaultTeamPreset, ascendantShards, ascensionPity, dungeon },
      world: farmerWorld,
    });
  }, [coins, farmXp, seeds, selectedCrop, plots, harvestedCrops, collection, fighters, activeTeam, teamPresets, defaultTeamPreset, ascendantShards, ascensionPity, dungeon, farmerWorld, scheduleSave]);

  return (
    <main className="sprout-safe-screen h-dvh overflow-hidden bg-[#171c19] text-[#2f3e2f]">
      <div className="mx-auto flex h-full max-w-6xl flex-col">
        <header className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-[#252d27] px-3 py-2 text-[#f4e8c1] shadow sm:flex-nowrap sm:gap-3 sm:px-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">Sprout 🌱</h1>
            <p className="hidden text-xs sm:block">
              Grow. Collect. Mutate. Fight.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 max-[399px]:w-full max-[399px]:justify-between sm:gap-2">
            <button type="button" onClick={() => setMenuGuide(null)} className="rounded-lg border border-white/20 px-2 py-1 text-xs font-bold text-[#f4e8c1] hover:bg-white/10">Main Menu</button>
            {process.env.NODE_ENV === "development" && (
              <button type="button" onClick={() => setShowLegacyPanels(true)} className="rounded-lg border border-white/20 px-2 py-1 text-xs font-bold text-[#f4e8c1] hover:bg-white/10">
                Debug panels
              </button>
            )}
            <div className="rounded-lg bg-[#ffe28a] px-2 py-1.5 text-sm font-black tabular-nums text-[#4a2c12] sm:px-3 sm:text-base">
              🪙 {coins}
            </div>
            <div className="rounded-lg bg-[#d9ed92] px-2 py-1.5 text-[11px] font-black tabular-nums text-[#304719] sm:px-3 sm:text-sm">
              Farm Lv {farmLevel} · {farmXp} XP
            </div>
            <div role="status" className={`rounded-lg px-2 py-1.5 text-[11px] font-black ${syncState === "saved" ? "bg-[#d9ed92] text-[#304719]" : syncState === "saving" ? "bg-[#ffe28a] text-[#4a2c12]" : "bg-[#ffd0b8] text-[#6f241d]"}`}>{saveLabel}</div>
          </div>
        </header>

        {saveWarning && <div className="mb-2 shrink-0 rounded-lg bg-[#ffd0b8] px-3 py-2 text-center text-xs font-bold text-[#6f241d]" role="alert">{saveWarning}</div>}

        <div className="min-h-0 flex-1">
          <PixelWorld coins={coins} unlockedPlotCount={unlockedPlotCount} plots={plots} now={now} selectedCrop={selectedCrop} setSelectedCrop={setSelectedCrop} seeds={seeds} buySeed={buySeed} handlePlotClick={handlePlotClick} harvestAll={harvestAll} fighters={fighters} activeTeam={activeTeam} teamPresets={teamPresets} defaultTeamPreset={defaultTeamPreset} ascendantShards={ascendantShards} ascensionPity={ascensionPity} dungeon={dungeon} collection={collection} harvestedCrops={harvestedCrops} sellCrops={sellCrops} awakenCrop={awakenCrop} fuseFighters={fuseFighters} setFighterLocked={setFighterLocked} setFighterFavorite={setFighterFavorite} renameFighter={renameFighter} releaseFighter={releaseFighter} dismantleFighter={dismantleFighter} setTeamPreset={setTeamPreset} renameTeamPreset={renameTeamPreset} setDefaultTeamPreset={setDefaultTeamPreset} awardDungeonVictory={awardDungeonVictory} notifications={notifications} notify={notify} onDismissNotification={dismissNotification} initialFarmerTile={farmerWorld.farmerTile} initialFarmerFacing={farmerWorld.facing} onFarmerSettled={handleFarmerSettled} onOpenGuide={(topic) => setMenuGuide(topic)} />
        </div>

        {menuGuide !== undefined && <MainMenu fighters={fighters} activeTeam={activeTeam} farmLevel={farmLevel} syncState={syncState} initialGuide={menuGuide} onClose={() => setMenuGuide(undefined)} />}

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
          <Battle fighters={fighters} onVictory={(result) => { awardDungeonVictory(result, 1); }} />
        </div>
        </div>
        )}
      </div>
    </main>
  );
}
