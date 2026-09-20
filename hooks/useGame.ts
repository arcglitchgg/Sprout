"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VICTORY_COINS } from "@/lib/battle-data";
import type { BattleState } from "@/lib/battle-types";
import { crops } from "@/lib/game-data";
import { isReady, rollMutation } from "@/lib/farming";
import { generateFighter } from "@/lib/fighters";
import { fuseFighters as createFusion } from "@/lib/fusion";
import { harvestPlot, removeHarvestedCrop, sellHarvestedCrop, sellHarvestedCrops } from "@/lib/inventory";
import { claimBattleVictoryReward, FARM_XP_REWARDS, getCrossedLevels, getFarmLevel, getUnlockedPlotCount, TOTAL_FARM_PLOTS } from "@/lib/progression";
import { INITIAL_SEEDS, plantWithSeed, purchaseSeed } from "@/lib/seeds";
import type { CollectionEntry, CropType, Fighter, HarvestedCrop, Plot, SeedInventory } from "@/lib/game-types";
import type { SproutGameSaveV2 } from "@/lib/save-types";
import type { WorldNotification } from "@/components/WorldNotifications";

type Notify = (notification: Omit<WorldNotification, "id">) => void;

export function useGame(initial?: SproutGameSaveV2, notify?: Notify) {
  const rewardedBattles = useRef(new Set<string>());
  const [coins, setCoins] = useState(initial?.coins ?? 100);
  const [farmXp, setFarmXp] = useState(initial?.farmXp ?? 0);
  const [selectedCrop, setSelectedCrop] = useState<CropType>(initial?.selectedCrop ?? "potato");
  const [seeds, setSeeds] = useState<SeedInventory>(() => initial ? { ...initial.seeds } : { ...INITIAL_SEEDS });
  const [now, setNow] = useState(0);
  const [plots, setPlots] = useState<Plot[]>(() => initial ? initial.plots.map((plot) => ({ ...plot })) : Array.from({ length: TOTAL_FARM_PLOTS }, (_, id) => ({ id, crop: null, plantedAt: null })));
  const [collection, setCollection] = useState<CollectionEntry[]>(() => initial ? initial.collection.map((entry) => ({ ...entry })) : []);
  const [harvestedCrops, setHarvestedCrops] = useState<HarvestedCrop[]>(() => initial ? initial.harvestedCrops.map((item) => ({ ...item })) : []);
  const [fighters, setFighters] = useState<Fighter[]>(() => initial ? initial.fighters.map((fighter) => ({ ...fighter })) : []);
  const coinsRef = useRef(coins);
  const farmXpRef = useRef(farmXp);
  const plotsRef = useRef(plots);
  const seedsRef = useRef(seeds);
  const harvestedCropsRef = useRef(harvestedCrops);
  const fightersRef = useRef(fighters);

  const farmLevel = getFarmLevel(farmXp);
  const unlockedPlotCount = getUnlockedPlotCount(farmXp);

  const awardFarmXp = useCallback((amount: number) => {
    if (amount <= 0) return;
    const previousXp = farmXpRef.current;
    const nextXp = previousXp + amount;
    farmXpRef.current = nextXp;
    setFarmXp(nextXp);
    const crossed = getCrossedLevels(previousXp, nextXp);
    if (crossed.length) {
      notify?.({
        kind: "level-up",
        title: `Farm Level ${crossed[crossed.length - 1]}!`,
        detail: `+${getUnlockedPlotCount(nextXp) - getUnlockedPlotCount(previousXp)} plots unlocked`,
      });
    }
  }, [notify]);

  const awardBattleVictory = useCallback((result: BattleState) => {
    if (!claimBattleVictoryReward(rewardedBattles.current, result)) return;
    coinsRef.current += VICTORY_COINS;
    setCoins(coinsRef.current);
    awardFarmXp(FARM_XP_REWARDS.dungeonVictory);
  }, [awardFarmXp]);

  useEffect(() => {
    const initialTick = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialTick);
      clearInterval(interval);
    };
  }, []);

  function plantCrop(id: number, plantedAt: number) {
    const result = plantWithSeed(plotsRef.current, seedsRef.current, id, selectedCrop, plantedAt, getUnlockedPlotCount(farmXpRef.current));
    if (!result.planted) return `No ${crops[selectedCrop].name} seeds — visit the Seed Store.`;
    plotsRef.current = result.plots;
    seedsRef.current = result.seeds;
    setNow(plantedAt);
    setPlots(result.plots);
    setSeeds(result.seeds);
    awardFarmXp(FARM_XP_REWARDS.plant);
    return null;
  }

  function handlePlotClick(plot: Plot, clickedAt: number) {
    const currentPlot = plotsRef.current.find((entry) => entry.id === plot.id);
    if (!currentPlot) return null;
    if (!currentPlot.crop) return plantCrop(currentPlot.id, clickedAt);
    if (isReady(currentPlot, clickedAt)) harvestCrop(currentPlot.id, clickedAt);
    return null;
  }

  function buySeed(crop: CropType) {
    const result = purchaseSeed(seedsRef.current, coinsRef.current, crop);
    if (!result.purchased) return;
    coinsRef.current = result.coins;
    seedsRef.current = result.seeds;
    setCoins(result.coins);
    setSeeds(result.seeds);
  }

  function harvestCrop(id: number, clickedAt: number) {
    const plot = plotsRef.current.find((entry) => entry.id === id);
    if (!plot?.crop || !isReady(plot, clickedAt)) return;
    const cropType = plot.crop;
    const mutation = rollMutation();
    const result = harvestPlot(plotsRef.current, harvestedCropsRef.current, id, mutation, clickedAt);
    if (!result) return;

    plotsRef.current = result.plots;
    harvestedCropsRef.current = result.items;
    setPlots(result.plots);
    setHarvestedCrops(result.items);
    const alreadyDiscovered = collection.some((entry) => entry.crop === cropType && entry.mutation === mutation);
    if (!alreadyDiscovered) setCollection((current) => [...current, { crop: cropType, mutation }]);
    const mutationName = mutation.charAt(0).toUpperCase() + mutation.slice(1);
    notify?.({
      kind: "success",
      title: alreadyDiscovered ? `${mutationName} ${crops[cropType].name} harvested` : `New discovery! ${mutationName} ${crops[cropType].name}`,
      detail: `Worth 🪙 ${result.item.sellValue}`,
    });
    awardFarmXp(FARM_XP_REWARDS.harvest);
  }

  function sellCrop(itemId: string) {
    const result = sellHarvestedCrop(harvestedCropsRef.current, coinsRef.current, itemId);
    if (!result.item) return;
    coinsRef.current = result.coins;
    harvestedCropsRef.current = result.remaining;
    setCoins(result.coins);
    setHarvestedCrops(result.remaining);
    awardFarmXp(FARM_XP_REWARDS.sell);
  }

  function sellCrops(itemIds: string[]) {
    const result = sellHarvestedCrops(harvestedCropsRef.current, coinsRef.current, itemIds);
    if (!result.sold.length) return;
    coinsRef.current = result.coins;
    harvestedCropsRef.current = result.remaining;
    setCoins(result.coins);
    setHarvestedCrops(result.remaining);
    awardFarmXp(result.sold.length * FARM_XP_REWARDS.sell);
  }

  function awakenCrop(itemId: string) {
    const result = removeHarvestedCrop(harvestedCropsRef.current, itemId);
    if (!result.item) return;
    const fighter = generateFighter(result.item);
    harvestedCropsRef.current = result.remaining;
    fightersRef.current = [...fightersRef.current, fighter];
    setFighters(fightersRef.current);
    setHarvestedCrops(result.remaining);
    awardFarmXp(FARM_XP_REWARDS.awaken);
  }

  function fuseFighters(selectedIds: string[]) {
    const fusion = createFusion(fightersRef.current, selectedIds);
    if (!fusion) return null;
    fightersRef.current = fusion.remaining;
    setFighters(fusion.remaining);
    return fusion.result;
  }

  return { coins, farmXp, farmLevel, unlockedPlotCount, selectedCrop, setSelectedCrop, seeds, buySeed, now, plots, collection, harvestedCrops, fighters, handlePlotClick, sellCrop, sellCrops, awakenCrop, fuseFighters, awardBattleVictory };
}
