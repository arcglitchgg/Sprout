"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VICTORY_COINS } from "@/lib/battle-data";
import type { BattleState } from "@/lib/battle-types";
import { crops } from "@/lib/game-data";
import { isReady, rollMutation } from "@/lib/farming";
import { generateFighter } from "@/lib/fighters";
import { harvestPlot, removeHarvestedCrop, sellHarvestedCrop } from "@/lib/inventory";
import { INITIAL_SEEDS, plantWithSeed, purchaseSeed } from "@/lib/seeds";
import type { CollectionEntry, CropType, Fighter, HarvestedCrop, MutationType, Plot, SeedInventory } from "@/lib/game-types";
import type { SproutGameSaveV1 } from "@/lib/save-types";

export function useGame(initial?: SproutGameSaveV1) {
  const rewardedBattles = useRef(new Set<string>());
  const [coins, setCoins] = useState(initial?.coins ?? 100);
  const awardBattleVictory = useCallback((result: BattleState) => {
    if (result.status !== "victory" || rewardedBattles.current.has(result.id)) return;
    rewardedBattles.current.add(result.id);
    setCoins((current) => current + VICTORY_COINS);
  }, []);
  const [selectedCrop, setSelectedCrop] = useState<CropType>(initial?.selectedCrop ?? "potato");
  const [seeds, setSeeds] = useState<SeedInventory>(() => initial ? { ...initial.seeds } : { ...INITIAL_SEEDS });
  const [now, setNow] = useState(0);

  const [plots, setPlots] = useState<Plot[]>(() =>
    initial ? initial.plots.map((plot) => ({ ...plot })) : Array.from({ length: 9 }, (_, index) => ({
      id: index,
      crop: null,
      plantedAt: null,
    }))
  );

  const [collection, setCollection] = useState<CollectionEntry[]>(() => initial ? initial.collection.map((entry) => ({ ...entry })) : []);

  const [lastHarvest, setLastHarvest] = useState<{
    crop: CropType;
    mutation: MutationType;
    value: number;
    newDiscovery: boolean;
  } | null>(null);

  const [harvestedCrops, setHarvestedCrops] = useState<HarvestedCrop[]>(() => initial ? initial.harvestedCrops.map((item) => ({ ...item })) : []);

  const [fighters, setFighters] = useState<Fighter[]>(() => initial ? initial.fighters.map((fighter) => ({ ...fighter })) : []);

  useEffect(() => {
    const initialTick = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearTimeout(initialTick);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!lastHarvest) return;

    const timeout = setTimeout(() => {
      setLastHarvest(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [lastHarvest]);

  function plantCrop(id: number, plantedAt: number) {
    const result = plantWithSeed(plots, seeds, id, selectedCrop, plantedAt);
    if (!result.planted) return `No ${crops[selectedCrop].name} seeds — visit the Seed Store.`;
    setNow(plantedAt);
    setPlots(result.plots);
    setSeeds(result.seeds);
    return null;
  }

  function handlePlotClick(plot: Plot, clickedAt: number) {
    if (!plot.crop) {
      return plantCrop(plot.id, clickedAt);
    }

    if (isReady(plot, clickedAt)) {
      harvestCrop(plot.id, clickedAt);
    }
    return null;
  }

  function buySeed(crop: CropType) {
    const result = purchaseSeed(seeds, coins, crop);
    if (!result.purchased) return;
    setCoins(result.coins);
    setSeeds(result.seeds);
  }

  function harvestCrop(id: number, clickedAt: number) {
    const plot = plots.find(
      (currentPlot) => currentPlot.id === id
    );

    if (!plot?.crop || !isReady(plot, clickedAt)) return;

    const cropType = plot.crop;

    const mutation = rollMutation();
    const result = harvestPlot(plots, harvestedCrops, id, mutation, clickedAt);
    if (!result) return;

    const alreadyDiscovered = collection.some(
      (entry) =>
        entry.crop === cropType &&
        entry.mutation === mutation
    );

    if (!alreadyDiscovered) {
      setCollection((current) => [
        ...current,
        {
          crop: cropType,
          mutation,
        },
      ]);
    }

    setLastHarvest({
      crop: cropType,
      mutation,
      value: result.item.sellValue,
      newDiscovery: !alreadyDiscovered,
    });

    setHarvestedCrops((current) => [...current, result.item]);
    setPlots((currentPlots) => currentPlots.map((entry) => entry.id === id ? { ...entry, crop: null, plantedAt: null } : entry));
  }

  function sellCrop(itemId: string) {
    const { item } = sellHarvestedCrop(harvestedCrops, coins, itemId);
    if (!item) return;
    setCoins((current) => current + item.sellValue);
    setHarvestedCrops((current) => removeHarvestedCrop(current, itemId).remaining);
  }

  function awakenCrop(itemId: string) {
    const { item } = removeHarvestedCrop(harvestedCrops, itemId);
    if (!item) return;
    const fighter = generateFighter(item);
    setFighters((current) => [...current, fighter]);
    setHarvestedCrops((current) => removeHarvestedCrop(current, itemId).remaining);
  }

  return { coins, selectedCrop, setSelectedCrop, seeds, buySeed, now, plots, collection, lastHarvest, harvestedCrops, fighters, handlePlotClick, sellCrop, awakenCrop, awardBattleVictory };
}
