"use client";

import { useEffect, useState } from "react";
import { socialRequest } from "@/lib/social-client";
import type { SproutProfile } from "@/lib/social-types";

type Category = "money" | "combat-power" | "pvp-wins";
type Scope = "global" | "friends";
type Board = { entries: { rank: number; player: SproutProfile; value: number }[]; currentPlayer: { rank: number; value: number } | null };
type History = { matches: { id: string; opponent: SproutProfile; result: "win" | "loss" | "draw"; completedAt: string }[] };

export default function NeighborhoodRanks({ session, localId }: { session: string; localId: string | null }) {
  const [category, setCategory] = useState<Category>("pvp-wins");
  const [scope, setScope] = useState<Scope>("global");
  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    socialRequest<Board>(session, `/api/leaderboards?category=${category}&scope=${scope}`, "GET", undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setBoard(result); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [session, category, scope]);
  useEffect(() => {
    const controller = new AbortController();
    socialRequest<History>(session, "/api/pvp/history", "GET", undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setHistory(result); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [session]);
  return <div className="space-y-3 text-sm">
    <div className="flex flex-wrap gap-1" aria-label="Leaderboard category">
      {(["money", "combat-power", "pvp-wins"] as Category[]).map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setBoard(null); setError(null); setCategory(value); }} className={`rounded-lg px-3 py-2 font-bold ${category === value ? "bg-[#4f772d] text-white" : "bg-[#fff8dc]"}`}>{value === "money" ? "Money" : value === "combat-power" ? "Combat Power" : "PvP Wins"}</button>)}
    </div>
    <div className="flex gap-1" aria-label="Leaderboard scope">{(["global", "friends"] as Scope[]).map((value) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => { setBoard(null); setError(null); setScope(value); }} className={`rounded-lg px-3 py-1 font-bold ${scope === value ? "bg-[#d8b875]" : "bg-[#fff8dc]"}`}>{value === "global" ? "Global" : "Friends"}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    <div className="max-h-44 overflow-y-auto rounded-lg bg-[#fff8dc] p-2">
      {!board ? <p>Loading rankings…</p> : board.entries.length === 0 ? <p>No players yet.</p> : board.entries.map((entry) => <div key={entry.player.userId} className={`flex justify-between gap-2 border-b border-[#765438]/20 py-1 ${entry.player.userId === localId ? "font-black text-[#35591e]" : ""}`}><span className="truncate">#{entry.rank} {entry.player.displayName ?? entry.player.username}</span><span className="tabular-nums">{entry.value}</span></div>)}
    </div>
    {board?.currentPlayer && <p className="font-bold">Your rank: #{board.currentPlayer.rank} · {board.currentPlayer.value}</p>}
    <h3 className="font-black">Recent Battles</h3>
    <div className="max-h-32 overflow-y-auto rounded-lg bg-[#fff8dc] p-2">{!history ? <p>Loading battles…</p> : history.matches.length === 0 ? <p>No completed battles yet.</p> : history.matches.map((match) => <p key={match.id} className="py-1"><strong>{match.result.toUpperCase()}</strong> vs {match.opponent.displayName ?? match.opponent.username} · {new Date(match.completedAt).toLocaleDateString()}</p>)}</div>
  </div>;
}
