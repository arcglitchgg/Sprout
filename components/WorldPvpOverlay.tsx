"use client";

import { useEffect, useRef, useState } from "react";
import TeamSelector from "@/components/TeamSelector";
import FighterCard from "@/components/FighterCard";
import FriendlyBattle from "@/components/FriendlyBattle";
import { socialRequest } from "@/lib/social-client";
import type { Fighter } from "@/lib/game-types";
import type { LivePvpMatch } from "@/lib/pvp-types";
import { shouldCancelSetupOnLeave, validPvpTeamSelection } from "@/lib/pvp";

export default function WorldPvpOverlay({ session, localId, opponentId, opponentName, challengeId, presentIds, fighters, onClose }: {
  session: string; localId: string; opponentId: string; opponentName: string; challengeId: string;
  presentIds: string[]; fighters: Fighter[]; onClose: () => void;
}) {
  const [match, setMatch] = useState<LivePvpMatch | null>(null);
  const [selected, setSelected] = useState(["", "", ""]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const seenOpponent = useRef(false);
  const ready = match?.status === "ready" || match?.status === "active" || match?.status === "completed";
  const ended = opponentLeft || match?.status === "cancelled" || match?.status === "expired";
  const valid = validPvpTeamSelection(selected, fighters);

  useEffect(() => {
    let active = true;
    const load = () => void socialRequest<LivePvpMatch>(session, `/api/pvp/matches/${challengeId}`).then((next) => {
      if (!active) return;
      if (next.challengerId !== localId && next.opponentId !== localId) { setError("Match identity changed."); return; }
      setMatch(next);
      if (next.status === "cancelled" || next.status === "expired") setError(next.status === "expired" ? "Match setup expired." : "Match was cancelled.");
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    load();
    const timer = setInterval(load, 1000);
    return () => { active = false; clearInterval(timer); };
  }, [session, challengeId, localId]);

  useEffect(() => {
    if (presentIds.includes(opponentId)) seenOpponent.current = true;
    else if (shouldCancelSetupOnLeave(seenOpponent.current, false, match?.status ?? null)) {
      void socialRequest(session, `/api/pvp/matches/${challengeId}`, "DELETE").catch(() => {});
      setOpponentLeft(true);
      setError("Opponent left the farm. Match setup cancelled.");
    }
  }, [presentIds, opponentId, ready, match?.status, session, challengeId]);

  async function submit() {
    if (!valid || busy || submitted || ended) return;
    setBusy(true); setError(null);
    try { await socialRequest(session, `/api/pvp/matches/${challengeId}`, "PUT", { fighterIds: selected }); setSubmitted(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not ready your team."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!ready) await socialRequest(session, `/api/pvp/matches/${challengeId}`, "DELETE").catch(() => {});
    onClose();
  }

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0b0f0c]/95 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Friendly PvP">
    {ready && match?.challengerTeam && match.opponentTeam && match.battleId && match.battleSeed !== null
      ? <FriendlyBattle match={match} session={session} localId={localId} opponentName={opponentName} onReturn={onClose} />
      : <div className="mx-auto max-w-xl rounded-xl bg-[#f4e8c1] p-4 text-[#2f3e2f]">
        <h2 className="text-xl font-black">Friendly PvP vs {opponentName}</h2>
        <p className="text-sm">Choose three fighters. Both players must ready before battle starts.</p>
        {error && <p role="alert" className="mt-2 font-bold text-[#9b3d25]">{error}</p>}
        {!submitted && !ended && match?.status === "waiting_for_teams" && <><TeamSelector fighters={fighters} selected={selected} onSelect={setSelected} locked={busy} /><div className="mt-3 grid gap-2 sm:grid-cols-3">{selected.map((id, slot) => { const fighter = fighters.find((entry) => entry.id === id); return fighter ? <FighterCard key={`${slot}:${id}`} fighter={fighter} /> : null; })}</div><button type="button" disabled={!valid || busy} onClick={() => void submit()} className="mt-3 rounded-lg bg-[#4f772d] px-4 py-2 font-bold text-white disabled:opacity-40">Ready</button></>}
        {submitted && !error && <p className="mt-3 font-bold">Waiting for {opponentName} to ready...</p>}
        {!match && !error && <p className="mt-3">Loading match...</p>}
        <button type="button" onClick={() => void cancel()} className="ml-2 mt-3 rounded-lg border border-[#765438] px-4 py-2 font-bold">Cancel</button>
      </div>}
  </div>;
}
