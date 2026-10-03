"use client";

import { useEffect, useRef, useState } from "react";
import BattleArena from "@/components/BattleArena";
import type { BattlePresentationProgress } from "@/components/BattleArena";
import { createFriendlyBattle, resolveBattle } from "@/lib/battle";
import type { LivePvpMatch } from "@/lib/pvp-types";
import { friendlyResultForLocal } from "@/lib/pvp";
import { socialRequest } from "@/lib/social-client";

export default function FriendlyBattle({ match, session, localId, opponentName, onReturn }: { match: LivePvpMatch; session: string; localId: string; opponentName: string; onReturn: () => void }) {
  const [battle] = useState(() => resolveBattle(createFriendlyBattle(match.challengerTeam!, match.opponentTeam!, match.battleId!, match.battleSeed!)));
  const [progress, setProgress] = useState<BattlePresentationProgress>({ elapsed: 0, logCount: 0, complete: false });
  const [preparation, setPreparation] = useState("Preparing Battle");
  const finalizing = useRef(false);
  const [final, setFinal] = useState<{ result: string; winnerId: string | null; pvpWins: number } | null>(null);
  const [finalError, setFinalError] = useState<string | null>(null);
  useEffect(() => {
    const steps = ["3", "2", "1", "FIGHT!", ""];
    const timers = steps.map((step, index) => setTimeout(() => setPreparation(step), 250 * (index + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);
  const localIsChallenger = localId === match.challengerId;
  const displayedResult = preparation || (progress.complete ? friendlyResultForLocal(battle.status, localIsChallenger) : "Battle in progress");
  async function finalize() {
    if (finalizing.current || final) return;
    finalizing.current = true; setFinalError(null);
    try { setFinal(await socialRequest(session, `/api/pvp/matches/${match.id}/complete`, "POST")); }
    catch (error) { setFinalError(error instanceof Error ? error.message : "Could not record the result."); }
    finally { finalizing.current = false; }
  }
  useEffect(() => {
    if (battle.status === "running" || finalizing.current) return;
    finalizing.current = true;
    socialRequest<{ result: string; winnerId: string | null; pvpWins: number }>(session, `/api/pvp/matches/${match.id}/complete`, "POST")
      .then(setFinal)
      .catch((error: Error) => setFinalError(error.message))
      .finally(() => { finalizing.current = false; });
  }, [battle.status, session, match.id]);
  return <div className="mx-auto max-w-5xl rounded-xl bg-[#f4e8c1] p-2 text-[#2f3e2f] sm:p-3">
    <h2 className="text-lg font-black">Friendly PvP vs {opponentName}</h2>
    <p className="text-sm">{match.challengerId === localId ? "Your team is on the left." : "Your team is on the right."} The winner earns one PvP Win.</p>
    <p role="status" className="my-2 font-bold">{progress.complete && final ? final.winnerId === null ? "Draw" : final.winnerId === localId ? "Victory" : "Defeat" : displayedResult}</p>
    {progress.complete && final && <p className="text-sm font-bold">PvP Wins: {final.pvpWins}</p>}
    {finalError && <p role="alert" className="text-sm">{finalError} <button type="button" onClick={() => void finalize()} className="underline">Retry recording result</button></p>}
    {preparation ? <div className="battle-arena grid place-items-center rounded-2xl border-4 border-[#637a45] bg-[#b7cc8b] text-3xl font-black">{preparation}</div> : <BattleArena battle={battle} team={match.challengerTeam!} onProgress={setProgress} sideLabels={[localIsChallenger ? "Your team" : `${opponentName}'s team`, localIsChallenger ? `${opponentName}'s team` : "Your team"]} />}
    <details className="mt-3"><summary className="cursor-pointer font-bold">Battle log</summary><div className="max-h-40 overflow-y-auto p-2 text-sm">{battle.log.slice(0, progress.logCount).map((event, index) => <p key={index}>{event.message.replace(/^Your /, `${localIsChallenger ? "Your" : opponentName + "'s"} `).replace(/^Enemy /, `${localIsChallenger ? opponentName + "'s" : "Your"} `)}</p>)}</div></details>
    {progress.complete && <button type="button" onClick={onReturn} className="mt-3 rounded-lg bg-[#4f772d] px-4 py-2 font-bold text-white">Return to Farm</button>}
  </div>;
}
