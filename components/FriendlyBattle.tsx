"use client";

import { useEffect, useRef, useState } from "react";
import BattleArena from "@/components/BattleArena";
import type { BattlePresentationProgress } from "@/components/BattleArena";
import { advanceBattle, createFriendlyBattle } from "@/lib/battle";
import type { LivePvpMatch } from "@/lib/pvp-types";
import { friendlyResultForLocal } from "@/lib/pvp";

export default function FriendlyBattle({ match, localId, opponentName, onReturn }: { match: LivePvpMatch; localId: string; opponentName: string; onReturn: () => void }) {
  const [battle, setBattle] = useState(() => createFriendlyBattle(match.challengerTeam!, match.opponentTeam!, match.battleId!, match.battleSeed!));
  const [progress, setProgress] = useState<BattlePresentationProgress>({ elapsed: 0, logCount: 1, complete: false });
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
    const interval = setInterval(() => setBattle((current) => current.status === "running" ? advanceBattle(current, performance.now() - startedAt.current) : current), 100);
    return () => clearInterval(interval);
  }, []);
  const localIsChallenger = localId === match.challengerId;
  const displayedResult = progress.complete ? friendlyResultForLocal(battle.status, localIsChallenger) : "Battle in progress";
  return <div className="mx-auto max-w-5xl rounded-xl bg-[#f4e8c1] p-3 text-[#2f3e2f]">
    <h2 className="text-lg font-black">Friendly PvP vs {opponentName}</h2>
    <p className="text-sm">{match.challengerId === localId ? "Your team is on the left." : "Your team is on the right."} No rewards or penalties.</p>
    <p role="status" className="my-2 font-bold">{displayedResult}</p>
    <BattleArena battle={battle} team={match.challengerTeam!} onProgress={setProgress} sideLabels={[localIsChallenger ? "Your team" : `${opponentName}'s team`, localIsChallenger ? `${opponentName}'s team` : "Your team"]} />
    <details className="mt-3"><summary className="cursor-pointer font-bold">Battle log</summary><div className="max-h-40 overflow-y-auto p-2 text-sm">{battle.log.slice(0, progress.logCount).map((event, index) => <p key={index}>{event.message.replace(/^Your /, `${localIsChallenger ? "Your" : opponentName + "'s"} `).replace(/^Enemy /, `${localIsChallenger ? opponentName + "'s" : "Your"} `)}</p>)}</div></details>
    {progress.complete && <button type="button" onClick={onReturn} className="mt-3 rounded-lg bg-[#4f772d] px-4 py-2 font-bold text-white">Return to Farm</button>}
  </div>;
}
