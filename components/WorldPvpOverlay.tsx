"use client";

import { useEffect, useRef, useState } from "react";
import TeamSelector from "@/components/TeamSelector";
import FighterCard from "@/components/FighterCard";
import FriendlyBattle from "@/components/FriendlyBattle";
import { socialRequest } from "@/lib/social-client";
import type { Fighter, TeamPresetIndex, TeamPresets } from "@/lib/game-types";
import type { LivePvpMatch } from "@/lib/pvp-types";
import { shouldCancelSetupOnLeave, validPvpTeamSelection } from "@/lib/pvp";
import { getDefaultBattleSelection, getDefaultPresetTeam, presetToActiveTeam, validActiveTeamSelection } from "@/lib/team-selection";

export default function WorldPvpOverlay({ session, localId, opponentId, opponentName, challengeId, presentIds, fighters, teamPresets, defaultTeamPreset, onClose }: {
  session: string; localId: string; opponentId: string; opponentName: string; challengeId: string;
  presentIds: string[]; fighters: Fighter[]; teamPresets: TeamPresets; defaultTeamPreset: TeamPresetIndex; onClose: () => void;
}) {
  const [match, setMatch] = useState<LivePvpMatch | null>(null);
  const activeTeam = getDefaultPresetTeam(teamPresets, defaultTeamPreset);
  const activeTeamValid = validActiveTeamSelection(activeTeam, fighters);
  const [selected, setSelected] = useState<string[]>(() => getDefaultBattleSelection(activeTeam, fighters));
  const [teamSource, setTeamSource] = useState<string>(activeTeamValid ? String(defaultTeamPreset) : "manual");
  const [choosingTeam, setChoosingTeam] = useState(!activeTeamValid);
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
  function chooseSource(value: string) {
    setTeamSource(value);
    if (value === "manual") { setChoosingTeam(true); return; }
    const team = presetToActiveTeam(teamPresets[Number(value) as TeamPresetIndex]);
    if (validActiveTeamSelection(team, fighters)) { setSelected([...team]); setChoosingTeam(false); } else setChoosingTeam(true);
  }

  async function cancel() {
    if (!ready) await socialRequest(session, `/api/pvp/matches/${challengeId}`, "DELETE").catch(() => {});
    onClose();
  }

  return <div className="sprout-safe-overlay fixed inset-0 z-[80] overflow-y-auto bg-[#0b0f0c]/95" role="dialog" aria-modal="true" aria-label="Friendly PvP">
    {ready && match?.challengerTeam && match.opponentTeam && match.battleId && match.battleSeed !== null
      ? <FriendlyBattle match={match} session={session} localId={localId} opponentName={opponentName} onReturn={onClose} />
      : <div className="mx-auto max-w-xl rounded-xl bg-[#f4e8c1] p-3 text-[#2f3e2f] sm:p-4">
        <h2 className="text-xl font-black">Friendly PvP vs {opponentName}</h2>
        <p className="text-sm">Choose three fighters. Both players must ready before battle starts.</p>
        {error && <p role="alert" className="mt-2 font-bold text-[#9b3d25]">{error}</p>}
        {!submitted && !ended && match?.status === "waiting_for_teams" && <><label className="mt-3 block text-sm font-bold">Team source<select value={teamSource} onChange={(event) => chooseSource(event.target.value)} className="mt-1 block w-full rounded-lg bg-[#fff8dc] p-2"><option value="manual">Manual</option>{teamPresets.map((preset, index) => <option key={index} value={index}>{preset.name}{index === defaultTeamPreset ? " · Default" : ""}</option>)}</select></label>{!choosingTeam && valid ? <div className="mt-4 rounded-xl bg-[#fff8dc] p-3"><div className="flex items-center justify-between gap-2"><strong>Active Team</strong><button type="button" onClick={() => setChoosingTeam(true)} className="text-sm font-bold underline">Choose Different Team</button></div></div> : <TeamSelector fighters={fighters} selected={selected} onSelect={setSelected} locked={busy} />}{!activeTeamValid && activeTeam.some(Boolean) && <p className="mt-2 text-sm font-bold text-[#8b2f24]">Active Team needs updating. Choose a team for this match.</p>}<div className="mt-3 grid gap-2 sm:grid-cols-3">{selected.map((id, slot) => { const fighter = fighters.find((entry) => entry.id === id); return fighter ? <div key={`${slot}:${id}`}><p className="mb-1 text-xs font-black">{slot === 0 ? "Front" : slot === 1 ? "Rear Left" : "Rear Right"}</p><FighterCard fighter={fighter} /></div> : null; })}</div><button type="button" disabled={!valid || busy} onClick={() => void submit()} className="mt-3 rounded-lg bg-[#4f772d] px-4 py-2 font-bold text-white disabled:opacity-40">Ready</button></>}
        {submitted && !error && <p className="mt-3 font-bold">Waiting for {opponentName} to ready...</p>}
        {!match && !error && <p className="mt-3">Loading match...</p>}
        <button type="button" onClick={() => void cancel()} className="ml-2 mt-3 rounded-lg border border-[#765438] px-4 py-2 font-bold">Cancel</button>
      </div>}
  </div>;
}

