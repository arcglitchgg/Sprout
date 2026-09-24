"use client";

import { useCallback, useMemo, useState } from "react";
import Battle from "@/components/Battle";
import { VICTORY_COINS } from "@/lib/battle-data";
import { createDungeonEnemyTeam, getDungeonFloorXp, getHighestUnlockedDungeonFloor, isDungeonBossFloor, MAX_DUNGEON_FLOOR } from "@/lib/dungeon";
import { crops, personalities } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle-types";
import type { DungeonVictoryReward } from "@/lib/dungeon";
import type { Fighter } from "@/lib/game-types";
import type { DungeonProgress } from "@/lib/save-types";

export default function WorldDungeonOverlay({ fighters, progress, onVictory, onClose }: {
  fighters: Fighter[];
  progress: DungeonProgress;
  onVictory: (result: BattleState, floor: number) => DungeonVictoryReward | null;
  onClose: () => void;
}) {
  const highestUnlocked = getHighestUnlockedDungeonFloor(progress);
  const [floor, setFloor] = useState(highestUnlocked);
  const [reward, setReward] = useState<DungeonVictoryReward | null>(null);
  const enemyTeam = useMemo(() => createDungeonEnemyTeam(floor), [floor]);
  const boss = isDungeonBossFloor(floor);
  const xp = getDungeonFloorXp(floor);

  const chooseFloor = (nextFloor: number) => {
    if (nextFloor < 1 || nextFloor > highestUnlocked) return;
    setReward(null);
    setFloor(nextFloor);
  };

  const finishVictory = useCallback((result: BattleState) => {
    const awarded = onVictory(result, floor);
    if (awarded) setReward(awarded);
  }, [floor, onVictory]);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0b0f0c]/90 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Dungeon battle">
      <div className="mx-auto max-w-5xl">
        <div className="sticky top-0 z-10 rounded-xl border border-white/15 bg-[#252d27] p-3 text-[#f4e8c1] shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-black">Dungeon Floor {floor} {boss ? "· BOSS" : ""}</h2>
              <p className="text-xs opacity-80">Highest unlocked: {highestUnlocked} · Enemies: {enemyTeam.length} · Reward: {xp} XP per fighter</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-4 py-2 font-bold">Return to world</button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" disabled={floor <= 1} onClick={() => chooseFloor(floor - 1)} className="rounded-lg bg-[#f4e8c1] px-3 py-1.5 font-bold text-[#2f3e2f] disabled:opacity-35">Previous</button>
            <select value={floor} onChange={(event) => chooseFloor(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg bg-[#f4e8c1] p-2 font-bold text-[#2f3e2f]" aria-label="Dungeon floor">
              {Array.from({ length: MAX_DUNGEON_FLOOR }, (_, index) => index + 1).map((value) => <option key={value} value={value} disabled={value > highestUnlocked}>Floor {value}{isDungeonBossFloor(value) ? " · Boss" : ""}{value > highestUnlocked ? " · Locked" : ""}</option>)}
            </select>
            <button type="button" disabled={floor >= highestUnlocked} onClick={() => chooseFloor(floor + 1)} className="rounded-lg bg-[#f4e8c1] px-3 py-1.5 font-bold text-[#2f3e2f] disabled:opacity-35">Next</button>
          </div>
        </div>

        {reward && <div className="mt-3 rounded-xl border-2 border-[#8bb64b] bg-[#e6f3c8] p-3 text-[#2f3e2f]" role="status">
          <h3 className="font-black">Floor {reward.floor} cleared · +{reward.xpPerFighter} Fighter XP</h3>
          {reward.gains.map((gain) => <p key={gain.fighterId} className="text-sm">{personalities[gain.personality].name} {crops[gain.crop].name} +{gain.xp} XP{gain.nextLevel > gain.previousLevel ? ` · Lv. ${gain.previousLevel} → Lv. ${gain.nextLevel}` : ""}</p>)}
          {reward.newlyCleared && reward.floor < MAX_DUNGEON_FLOOR && <p className="mt-1 text-sm font-bold">Floor {reward.floor + 1} unlocked!</p>}
        </div>}

        <Battle key={floor} fighters={fighters} enemyTeam={enemyTeam} title={`Dungeon Floor ${floor}${boss ? " · Boss" : ""}`}
          rewardDescription={`Victory: ${xp} Fighter XP per participant and ${VICTORY_COINS} coins.`}
          victoryDetail={`+${xp} Fighter XP · +${VICTORY_COINS} coins`} onVictory={finishVictory} />
      </div>
    </div>
  );
}
