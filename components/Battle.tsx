"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBattle } from "@/hooks/useBattle";
import { VICTORY_COINS } from "@/lib/battle-data";
import { isRewardableDungeonVictory } from "@/lib/battle";
import BattleArena from "@/components/BattleArena";
import type { BattlePresentationProgress } from "@/components/BattleArena";
import type { BattleState } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";
import TeamSelector from "@/components/TeamSelector";
import { retainExistingTeamIds } from "@/lib/team-selection";

export default function Battle({ fighters, onVictory, onComplete }: { fighters: Fighter[]; onVictory: (result: BattleState) => void; onComplete?: (result: BattleState) => void }) {
  const [selected, setSelected] = useState(["", "", ""]);
  const [presentation, setPresentation] = useState<BattlePresentationProgress>({ elapsed: 0, logCount: 0, complete: false });
  const { battle, startBattle } = useBattle();
  const logRef = useRef<HTMLDivElement>(null);
  const running = battle?.status === "running";
  const presenting = Boolean(battle && !presentation.complete);
  const availableSelection = retainExistingTeamIds(selected, fighters);
  const team = availableSelection.map((id) => fighters.find((fighter) => fighter.id === id)).filter((fighter): fighter is Fighter => Boolean(fighter));
  const valid = team.length === 3 && new Set(availableSelection).size === 3;
  const displayedTeam = battle
    ? battle.combatants.filter((fighter) => fighter.side === "player").sort((a, b) => a.slot - b.slot)
    : availableSelection.map((id) => fighters.find((fighter) => fighter.id === id));
  const updatePresentation = useCallback((progress: BattlePresentationProgress) => setPresentation(progress), []);
  const displayedStatus = battle && presentation.complete ? battle.status : battle ? "running" : null;

  function beginBattle() {
    setPresentation({ elapsed: 0, logCount: 1, complete: false });
    startBattle(team);
  }

  useEffect(() => {
    if (!battle || battle.status === "running" || !presentation.complete) return;
    if (isRewardableDungeonVictory(battle)) onVictory(battle);
    onComplete?.(battle);
  }, [battle, onVictory, onComplete, presentation.complete]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [presentation.logCount]);

  return (
    <section className="mt-6 rounded-2xl bg-[#f4e8c1] p-4">
      <h2 className="text-xl font-bold">Training Garden · 3v3</h2>
      <p className="mt-1 text-sm">Victory: {VICTORY_COINS} coins. Defeat or draw: no penalty. Fighters recover fully after battle.</p>
      <TeamSelector fighters={fighters} selected={availableSelection} onSelect={setSelected} locked={running || presenting} />
      <button disabled={!valid || running || presenting} onClick={beginBattle} className="my-4 rounded-xl bg-[#d9ed92] px-5 py-3 font-bold disabled:opacity-40">
        {presenting ? "Battle in progress" : battle ? "Battle again" : "Start battle"}
      </button>
      <p role="status" className="mb-3 font-bold">
        {battle ? `${displayedStatus?.toUpperCase()} · ${Math.floor(presentation.elapsed / 1000)} / 60s${displayedStatus === "victory" ? ` · +${VICTORY_COINS} coins` : ""}` : "Ready when your team is selected"}
      </p>
      <BattleArena key={battle?.id ?? "preview"} battle={battle} team={displayedTeam} onProgress={updatePresentation} />
      {battle && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Battle log</summary><div ref={logRef} role="log" aria-label="Battle log" className="mt-4 max-h-56 overflow-y-auto rounded-xl bg-[#fff8dc] p-3 text-sm">
        {battle.log.slice(0, presentation.logCount).map((event, index) => <p key={index}>[{(event.at / 1000).toFixed(1)}s] {event.message}</p>)}
      </div></details>}
    </section>
  );
}
