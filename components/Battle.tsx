"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBattle } from "@/hooks/useBattle";
import { VICTORY_COINS } from "@/lib/battle-data";
import BattleArena from "@/components/BattleArena";
import type { BattlePresentationProgress } from "@/components/BattleArena";
import type { BattleState } from "@/lib/battle-types";
import type { Fighter, TeamPresetIndex, TeamPresets } from "@/lib/game-types";
import TeamSelector, { TeamCardPreview } from "@/components/TeamSelector";
import { getDefaultBattleSelection, presetToActiveTeam, retainExistingTeamIds, validActiveTeamSelection } from "@/lib/team-selection";

export default function Battle({ fighters, enemyTeam, initialTeamIds, teamPresets, defaultTeamPreset = 0, title = "Training Garden · 3v3", rewardDescription, victoryDetail, onVictory, onComplete }: {
  fighters: Fighter[];
  enemyTeam?: Fighter[];
  initialTeamIds?: (string | null)[];
  teamPresets?: TeamPresets;
  defaultTeamPreset?: TeamPresetIndex;
  title?: string;
  rewardDescription?: string;
  victoryDetail?: string;
  onVictory?: (result: BattleState) => void;
  onComplete?: (result: BattleState) => void;
}) {
  const initialValid = validActiveTeamSelection(initialTeamIds, fighters);
  const [selected, setSelected] = useState<string[]>(() => getDefaultBattleSelection(initialTeamIds, fighters));
  const [choosingTeam, setChoosingTeam] = useState(!initialValid);
  const [teamSource, setTeamSource] = useState<string>(teamPresets && initialValid ? String(defaultTeamPreset) : "manual");
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
    setPresentation({ elapsed: 0, logCount: 0, complete: false });
    startBattle(team, enemyTeam);
  }
  function chooseSource(value: string) {
    setTeamSource(value);
    if (value === "manual" || !teamPresets) { setChoosingTeam(true); return; }
    const team = presetToActiveTeam(teamPresets[Number(value) as TeamPresetIndex]);
    if (validActiveTeamSelection(team, fighters)) { setSelected([...team]); setChoosingTeam(false); } else setChoosingTeam(true);
  }

  useEffect(() => {
    if (!battle || battle.status === "running" || !presentation.complete) return;
    if (battle.status === "victory") onVictory?.(battle);
    onComplete?.(battle);
  }, [battle, onVictory, onComplete, presentation.complete]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [presentation.logCount]);

  return (
    <section className="mt-6 rounded-2xl bg-[#f4e8c1] p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm">{rewardDescription ?? `Victory: ${VICTORY_COINS} coins.`} Defeat or draw: no penalty. Fighters recover fully after battle.</p>
      {teamPresets && <label className="mt-3 block text-sm font-bold">Team source<select value={teamSource} onChange={(event) => chooseSource(event.target.value)} className="mt-1 block w-full rounded-lg bg-[#fff8dc] p-2"><option value="manual">Manual</option>{teamPresets.map((preset, index) => <option key={index} value={index}>{preset.name}{index === defaultTeamPreset ? " · Default" : ""}</option>)}</select></label>}
      {!choosingTeam && valid && <div className="mt-4 rounded-xl bg-[#fff8dc] p-3"><div className="flex items-center justify-between gap-2"><strong>Selected preset</strong><button type="button" onClick={() => { setTeamSource("manual"); setChoosingTeam(true); }} className="text-sm font-bold underline">Choose Different Team</button></div><TeamCardPreview fighters={fighters} selected={availableSelection} /></div>}
      {choosingTeam && <TeamSelector fighters={fighters} selected={availableSelection} onSelect={setSelected} locked={running || presenting} />}
      {!initialValid && initialTeamIds?.some(Boolean) && <p className="mt-2 text-sm font-bold text-[#8b2f24]">Active Team needs updating. Choose a team for this battle.</p>}
      <button disabled={!valid || running || presenting} onClick={beginBattle} className="my-4 rounded-xl bg-[#d9ed92] px-5 py-3 font-bold disabled:opacity-40">
        {presenting ? "Battle in progress" : battle ? "Battle again" : "Start battle"}
      </button>
      <p role="status" className="mb-3 font-bold">
        {battle ? `${displayedStatus?.toUpperCase()} · ${Math.floor(presentation.elapsed / 1000)} / 60s${displayedStatus === "victory" ? ` · ${victoryDetail ?? `+${VICTORY_COINS} coins`}` : ""}` : "Ready when your team is selected"}
      </p>
      <BattleArena key={battle?.id ?? "preview"} battle={battle} team={displayedTeam} previewEnemyTeam={enemyTeam} onProgress={updatePresentation} />
      {battle && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Battle log</summary><div ref={logRef} role="log" aria-label="Battle log" className="mt-4 max-h-56 overflow-y-auto rounded-xl bg-[#fff8dc] p-3 text-sm">
        {battle.log.slice(0, presentation.logCount).map((event, index) => <p key={index}>[{(event.at / 1000).toFixed(1)}s] {event.message}</p>)}
      </div></details>}
    </section>
  );
}
