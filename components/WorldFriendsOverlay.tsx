"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useDiscord } from "@/hooks/useDiscord";
import { socialRequest } from "@/lib/social-client";
import FighterCard from "@/components/FighterCard";
import type { Fighter } from "@/lib/game-types";
import type { DefenseTeam, FriendAction, FriendFarmSnapshot, FriendLists, SproutProfile } from "@/lib/social-types";
import { getRealtimeDiagnostics, subscribeRealtimeDiagnostics } from "@/lib/realtime-diagnostics";

const button = "rounded-lg bg-[#4f772d] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40";
type Tab = "friends" | "requests" | "search" | "defense";

export default function WorldFriendsOverlay({ fighters, onVisit, onClose, presenceOwnerId, presenceRole, presenceMemberCount }: {
  fighters: Fighter[]; onVisit: (snapshot: FriendFarmSnapshot) => void; onClose: () => void;
  presenceOwnerId: string | null; presenceRole: "owner" | "visitor"; presenceMemberCount: number;
}) {
  const { session } = useDiscord();
  const [tab, setTab] = useState<Tab>("friends");
  const [lists, setLists] = useState<FriendLists>({ friends: [], incoming: [], outgoing: [] });
  const [results, setResults] = useState<SproutProfile[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [defense, setDefense] = useState<DefenseTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const listsRevision = useRef(0);
  const selected = selectedIds.filter((id) => fighters.some((fighter) => fighter.id === id));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const revision = listsRevision.current;
    socialRequest<FriendLists>(session, "/api/friends", "GET", undefined, controller.signal).then((data) => {
      if (!controller.signal.aborted && revision === listsRevision.current) setLists(data);
    }).catch((e: Error) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [session]);

  useEffect(() => {
    if (!session || tab !== "defense") return;
    const controller = new AbortController();
    socialRequest<DefenseTeam>(session, "/api/defense-team", "GET", undefined, controller.signal).then((team) => {
      if (!controller.signal.aborted) { setDefense(team); setSelectedIds(team.fighters.map((fighter) => fighter.id)); }
    }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [session, tab]);

  async function run(action: () => Promise<void>) {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(null); setMessage(null);
    try { await action(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Please try again."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }

  function friendAction(profile: SproutProfile, action: FriendAction) {
    void run(async () => {
      listsRevision.current += 1;
      const id = encodeURIComponent(profile.userId);
      await socialRequest(session!, action === "request" ? "/api/friends/requests" : `/api/friends/${id}${action === "remove" ? "" : `/${action}`}`, action === "remove" ? "DELETE" : "POST", action === "request" ? { friendId: profile.userId } : undefined);
      const updated = await socialRequest<FriendLists>(session!, "/api/friends");
      if (mounted.current) { setLists(updated); setMessage(action === "request" ? "Friend request sent." : "Friends updated."); }
    });
  }

  function visit(profile: SproutProfile) {
    void run(async () => {
      const snapshot = await socialRequest<FriendFarmSnapshot>(session!, `/api/friends/${encodeURIComponent(profile.userId)}/farm`);
      if (mounted.current) onVisit(snapshot);
    });
  }

  function profileRow(profile: SproutProfile, actions: React.ReactNode) {
    return <article key={profile.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fff8dc] p-3">
      <div className="min-w-0 flex-1"><strong className="block truncate">{profile.displayName ?? profile.username}</strong><p className="truncate text-xs opacity-70">@{profile.username}</p><p className="text-xs">Farm Lv {profile.farmLevel} · CP {profile.combatPower} · {profile.coins} coins</p></div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </article>;
  }

  return <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/65 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="friends-title">
    <section className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-2 bg-[#d8b875] px-4 py-3"><h2 id="friends-title" className="text-lg font-bold">Friends / Neighborhood</h2><button type="button" onClick={onClose} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold">Close</button></header>
      {process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1" && <RealtimeDebugPanel ownerId={presenceOwnerId} role={presenceRole} memberCount={presenceMemberCount} />}
      {!session ? <p className="p-5 text-sm">Open Sprout in Discord with a connected cloud session to use Neighborhood. Your local farm remains available.</p> : <>
        <nav className="flex shrink-0 gap-1 overflow-x-auto p-2" aria-label="Neighborhood sections">
          {(["friends", "requests", "search", "defense"] as Tab[]).map((value) => <button key={value} type="button" disabled={busy} onClick={() => { if (value !== tab && value === "defense") { setDefense(null); setSelectedIds([]); } setTab(value); setError(null); setMessage(null); }} aria-pressed={tab === value} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${tab === value ? "bg-[#fff8dc]" : "bg-[#d8b875]/50"}`}>{value === "defense" ? "Defense Team" : value === "requests" ? `Requests (${lists.incoming.length})` : value === "search" ? "Player Search" : "Friends"}</button>)}
        </nav>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {error && <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-900">{error}</p>}
          {message && <p role="status" className="text-sm font-bold">{message}</p>}
          {busy && <p role="status" className="text-xs">Connecting…</p>}
          {(tab === "friends" || tab === "requests") && <button className={button} type="button" disabled={busy} onClick={() => void run(async () => { listsRevision.current += 1; const data = await socialRequest<FriendLists>(session, "/api/friends"); if (mounted.current) setLists(data); })}>Refresh</button>}
          {tab === "friends" && <>
            {lists.friends.length === 0 && <p className="p-3 text-sm">No friends yet. Find a Sprout player in Player Search.</p>}
            {lists.friends.map((profile) => profileRow(profile, <><button className={button} type="button" disabled={busy} onClick={() => visit(profile)}>Visit Farm</button><button className="px-2 text-xs underline" type="button" disabled={busy} onClick={() => friendAction(profile, "remove")}>Remove</button></>))}
          </>}
          {tab === "requests" && <>
            <h3 className="font-bold">Incoming requests</h3>
            {!lists.incoming.length && <p className="text-sm">No incoming requests.</p>}
            {lists.incoming.map((profile) => profileRow(profile, <><button className={button} type="button" disabled={busy} onClick={() => friendAction(profile, "accept")}>Accept</button><button className="px-2 text-sm underline" type="button" disabled={busy} onClick={() => friendAction(profile, "decline")}>Decline</button></>))}
            <h3 className="font-bold">Outgoing requests</h3>
            {!lists.outgoing.length && <p className="text-sm">No outgoing requests.</p>}
            {lists.outgoing.map((profile) => profileRow(profile, <button className={button} type="button" disabled={busy} onClick={() => friendAction(profile, "cancel")}>Cancel request</button>))}
          </>}
          {tab === "search" && <>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { const data = await socialRequest<{ players: SproutProfile[] }>(session, `/api/players/search?q=${encodeURIComponent(query.trim())}`); if (mounted.current) { setResults(data.players); setMessage(data.players.length ? null : "No players found."); } }); }}>
              <input aria-label="Search players by name" placeholder="Username or display name" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={64} className="min-w-0 flex-1 rounded-lg bg-white p-2 text-sm" />
              <button className={button} disabled={busy || query.trim().length < 2}>Search</button>
            </form>
            {results.map((profile) => {
              const known = [...lists.friends, ...lists.incoming, ...lists.outgoing].some((entry) => entry.userId === profile.userId);
              return profileRow(profile, <button type="button" className={button} disabled={busy || known} onClick={() => friendAction(profile, "request")}>{known ? "Friend / pending" : "Add Friend"}</button>);
            })}
          </>}
          {tab === "defense" && <>
            <p className="text-sm">Select up to 3 fighters in formation order. Defense uses your latest cloud-saved roster. Challenges will require all 3.</p>
            <div className="flex flex-wrap items-center gap-3"><strong>{selected.length} / 3 selected</strong><span className="text-sm">Saved CP: {defense?.combatPower ?? "—"}</span><button type="button" className="text-sm underline" disabled={busy || defense === null} onClick={() => setSelectedIds([])}>Clear</button></div>
            <button type="button" className={button} disabled={busy || defense === null} onClick={() => void run(async () => { const team = await socialRequest<DefenseTeam>(session, "/api/defense-team", "PUT", { fighterIds: selected }); if (mounted.current) { setDefense(team); setSelectedIds(team.fighters.map((f) => f.id)); setMessage("Defense team saved."); } })}>Save Defense</button>
            {!fighters.length && <p className="text-sm">Awaken fighters at your Farmhouse to set a defense team.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{fighters.map((fighter) => <button key={fighter.id} type="button" disabled={busy || defense === null || (!selected.includes(fighter.id) && selected.length >= 3)} aria-pressed={selected.includes(fighter.id)} onClick={() => setSelectedIds(selected.includes(fighter.id) ? selected.filter((id) => id !== fighter.id) : [...selected, fighter.id])} className={`rounded-xl border-2 text-left disabled:opacity-50 ${selected.includes(fighter.id) ? "border-[#4f772d] bg-[#d9ed92]" : "border-transparent"}`}><FighterCard fighter={fighter} />{selected.includes(fighter.id) && <span className="block px-3 pb-2 text-xs font-bold">Slot {selected.indexOf(fighter.id) + 1}</span>}</button>)}</div>
          </>}
        </div>
      </>}
    </section>
  </div>;
}

function RealtimeDebugPanel({ ownerId, role, memberCount }: { ownerId: string | null; role: "owner" | "visitor"; memberCount: number }) {
  const diagnostics = useSyncExternalStore(subscribeRealtimeDiagnostics, getRealtimeDiagnostics, getRealtimeDiagnostics);
  const safeRoom = ownerId && /^\d{5,25}$/.test(ownerId) ? `farm:…${ownerId.slice(-4)}` : "none";
  return <aside className="shrink-0 border-b border-[#765438]/30 bg-[#2b382d] px-3 py-2 text-xs text-[#f4e8c1]" aria-label="Realtime diagnostics">
    <div className="flex flex-wrap gap-x-4 gap-y-1"><span>Realtime Debug — <strong>{diagnostics.stage}</strong></span><span>Room: {safeRoom}</span><span>Role: {role}</span><span>Members seen: {memberCount}</span></div>
    <p className="mt-1 break-words text-[#d7e4cb]">Recent: {diagnostics.recent.join(" → ")}</p>
    {diagnostics.error && <p className="mt-1 break-words text-[#ffd4b0]">Status: {diagnostics.error}</p>}
  </aside>;
}
