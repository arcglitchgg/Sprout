"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VICTORY_COINS } from "@/lib/battle-data";
import { awakenHarvestedCrop } from "@/lib/awakening";
import { applyDungeonVictory, INITIAL_DUNGEON_PROGRESS } from "@/lib/dungeon";
import type { BattleState } from "@/lib/battle-types";
import { crops } from "@/lib/game-data";
import { isReady, rollMutation } from "@/lib/farming";
import { fuseFighters as createFusion, INITIAL_ASCENSION_PITY } from "@/lib/fusion";
import { harvestPlot, harvestReadyPlots, sellHarvestedCrop, sellHarvestedCrops } from "@/lib/inventory";
import { FARM_XP_REWARDS, getCrossedLevels, getFarmLevel, getUnlockedPlotCount, TOTAL_FARM_PLOTS } from "@/lib/progression";
import { INITIAL_SEEDS, plantWithSeed, purchaseSeed } from "@/lib/seeds";
import type { AscensionPity, CollectionEntry, CropType, Fighter, HarvestedCrop, Plot, SeedInventory } from "@/lib/game-types";
import type { SproutGameSaveV3 } from "@/lib/save-types";
import type { WorldNotification } from "@/components/WorldNotifications";

type Notify = (notification: Omit<WorldNotification, "id">) => void;

export function useGame(initial?: SproutGameSaveV3, notify?: Notify) {
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
  const [ascensionPity, setAscensionPity] = useState<AscensionPity>(() => ({ ...INITIAL_ASCENSION_PITY, ...initial?.ascensionPity }));
  const [dungeon, setDungeon] = useState(() => initial?.dungeon ? structuredClone(initial.dungeon) : { ...INITIAL_DUNGEON_PROGRESS });
  const coinsRef = useRef(coins);
  const farmXpRef = useRef(farmXp);
  const plotsRef = useRef(plots);
  const seedsRef = useRef(seeds);
  const harvestedCropsRef = useRef(harvestedCrops);
  const collectionRef = useRef(collection);
  const fightersRef = useRef(fighters);
  const dungeonRef = useRef(dungeon);
  const ascensionPityRef = useRef(ascensionPity);

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

  const awardDungeonVictory = useCallback((result: BattleState, floor: number) => {
    const awarded = applyDungeonVictory(fightersRef.current, dungeonRef.current, result, floor, rewardedBattles.current);
    if (!awarded) return null;
    fightersRef.current = awarded.fighters;
    dungeonRef.current = awarded.progress;
    coinsRef.current += VICTORY_COINS;
    setFighters(awarded.fighters);
    setDungeon(awarded.progress);
    setCoins(coinsRef.current);
    awardFarmXp(FARM_XP_REWARDS.dungeonVictory);
    return awarded.reward;
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

  function buySeed(crop: CropType, quantity = 1) {
    const result = purchaseSeed(seedsRef.current, coinsRef.current, crop, quantity);
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
    const alreadyDiscovered = collectionRef.current.some((entry) => entry.crop === cropType && entry.mutation === mutation);
    if (!alreadyDiscovered) {
      collectionRef.current = [...collectionRef.current, { crop: cropType, mutation }];
      setCollection(collectionRef.current);
    }
    const mutationName = mutation.charAt(0).toUpperCase() + mutation.slice(1);
    notify?.({
      kind: "success",
      title: alreadyDiscovered ? `${mutationName} ${crops[cropType].name} harvested` : `New discovery! ${mutationName} ${crops[cropType].name}`,
      detail: `Worth 🪙 ${result.item.sellValue}`,
    });
    awardFarmXp(FARM_XP_REWARDS.harvest);
  }

  function harvestAll(clickedAt: number) {
    const result = harvestReadyPlots(plotsRef.current, harvestedCropsRef.current, getUnlockedPlotCount(farmXpRef.current), clickedAt, rollMutation);
    if (!result.harvested.length) return 0;
    plotsRef.current = result.plots;
    harvestedCropsRef.current = result.items;
    setPlots(result.plots);
    setHarvestedCrops(result.items);
    const unique = new Map(collectionRef.current.map((entry) => [`${entry.crop}:${entry.mutation}`, entry]));
    let discoveries = 0;
    for (const item of result.harvested) {
      const key = `${item.crop}:${item.mutation}`;
      if (!unique.has(key)) { unique.set(key, { crop: item.crop, mutation: item.mutation }); discoveries += 1; }
    }
    if (discoveries) {
      collectionRef.current = [...unique.values()];
      setCollection(collectionRef.current);
    }
    awardFarmXp(result.harvested.length * FARM_XP_REWARDS.harvest);
    const counts = { normal: 0, large: 0, golden: 0, prismatic: 0 };
    for (const item of result.harvested) counts[item.mutation] += 1;
    const detail = (Object.entries(counts) as [keyof typeof counts, number][])
      .filter(([, count]) => count > 0).map(([mutation, count]) => `${count} ${mutation[0].toUpperCase()}${mutation.slice(1)}`).join(" · ");
    notify?.({ kind: "success", title: `Harvested ${result.harvested.length} crops`, detail: discoveries ? `${detail} · ${discoveries} new discoveries` : detail });
    return result.harvested.length;
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
    const result = awakenHarvestedCrop(harvestedCropsRef.current, fightersRef.current, coinsRef.current, itemId);
    if (!result.awakened) {
      if (result.reason === "coins") notify?.({ kind: "error", title: "Not enough coins", detail: `Awakening costs ${result.cost} coins.` });
      return null;
    }
    coinsRef.current = result.coins;
    harvestedCropsRef.current = result.items;
    fightersRef.current = result.fighters;
    setCoins(result.coins);
    setFighters(result.fighters);
    setHarvestedCrops(result.items);
    awardFarmXp(FARM_XP_REWARDS.awaken);
    return result.fighter;
  }

  function fuseFighters(selectedIds: string[]) {
    const fusion = createFusion(fightersRef.current, selectedIds, Math.random, ascensionPityRef.current);
    if (!fusion) return null;
    fightersRef.current = fusion.remaining;
    ascensionPityRef.current = fusion.pity;
    setFighters(fusion.remaining);
    setAscensionPity(fusion.pity);
    return fusion.result;
  }

  return { coins, farmXp, farmLevel, unlockedPlotCount, selectedCrop, setSelectedCrop, seeds, buySeed, now, plots, collection, harvestedCrops, fighters, ascensionPity, dungeon, handlePlotClick, harvestAll, sellCrop, sellCrops, awakenCrop, fuseFighters, awardDungeonVictory };
}
