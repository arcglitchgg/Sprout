"use client";

import { useEffect, useState } from "react";
import { useDiscord } from "@/hooks/useDiscord";
import { crops, mutations, personalities } from "@/lib/game-data";
import { GUIDE_TOPICS, PATCH_NOTES, type GuideTopicId } from "@/lib/guide-data";
import { getActiveTeamCombatPower, getActiveTeamFighters, getActiveTeamTagline } from "@/lib/main-menu";
import type { ActiveTeam, Fighter } from "@/lib/game-types";
import type { SyncState } from "@/hooks/useSproutPersistence";

type Section = "active-team" | "guides" | "patch-notes" | "account";

export default function MainMenu({ fighters, activeTeam, farmLevel, syncState, initialGuide, onClose }: { fighters: Fighter[]; activeTeam: ActiveTeam; farmLevel: number; syncState: SyncState; initialGuide?: GuideTopicId | null; onClose: () => void }) {
  const discord = useDiscord();
  const [section, setSection] = useState<Section>(initialGuide ? "guides" : "active-team");
  const [guide, setGuide] = useState<GuideTopicId>(initialGuide ?? "getting-started");
  useEffect(() => { if (initialGuide) { setSection("guides"); setGuide(initialGuide); } }, [initialGuide]);
  const team = getActiveTeamFighters(activeTeam, fighters);
  const cp = getActiveTeamCombatPower(activeTeam, fighters);
  const sessionStatus = discord.sessionDisconnected ? "Session Disconnected" : discord.environment === "discord" && (!discord.session || syncState === "loading-cloud" || syncState === "unsynced" || syncState === "conflict") ? "Reconnecting" : "Connected";
  const avatar = discord.user?.avatar ? (discord.user.avatar.startsWith("http") ? discord.user.avatar : `https://cdn.discordapp.com/avatars/${discord.user.id}/${discord.user.avatar}.png?size=64`) : null;

  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="main-menu-title">
    <section className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
      <header className="flex items-center justify-between bg-[#d8b875] px-4 py-3"><h2 id="main-menu-title" className="text-xl font-black">Main Menu</h2><button type="button" onClick={onClose} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold">Close</button></header>
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#765438]/25 p-2" aria-label="Main Menu sections">{(["active-team", "guides", "patch-notes", "account"] as Section[]).map((value) => <button key={value} type="button" onClick={() => setSection(value)} aria-pressed={section === value} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${section === value ? "bg-[#fff8dc]" : "bg-[#d8b875]/50"}`}>{value === "active-team" ? "Active Team" : value === "patch-notes" ? "Patch Notes" : value[0].toUpperCase() + value.slice(1)}</button>)}</nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {section === "active-team" && <section><div className="flex items-center justify-between gap-2"><h3 className="text-lg font-black">Active Team</h3><strong>Combat Power: {cp ?? "—"}</strong></div><p className="mt-1 italic">“{getActiveTeamTagline(activeTeam, fighters)}”</p>{team ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{team.map((fighter, index) => <article key={fighter.id} className="rounded-xl bg-[#fff8dc] p-3"><strong>{index === 0 ? "Front" : index === 1 ? "Rear Left" : "Rear Right"}</strong><p className="mt-1">Lv. {fighter.level} {mutations[fighter.mutation].name} {crops[fighter.crop].name}</p><p className="text-sm">{personalities[fighter.personality].name}</p></article>)}</div> : <p className="mt-4 rounded-xl bg-[#fff8dc] p-4 text-sm">Your Active Team is incomplete. Edit it in the Farmhouse under Active Team.</p>}</section>}
        {section === "guides" && <section className="grid gap-3 sm:grid-cols-[180px_1fr]"><nav className="flex gap-1 overflow-x-auto sm:flex-col" aria-label="Guide topics">{GUIDE_TOPICS.map((topic) => <button key={topic.id} type="button" onClick={() => setGuide(topic.id)} aria-pressed={guide === topic.id} className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-bold ${guide === topic.id ? "bg-[#4f772d] text-white" : "bg-[#fff8dc]"}`}>{topic.title}</button>)}</nav>{GUIDE_TOPICS.filter((topic) => topic.id === guide).map((topic) => <article key={topic.id} className="rounded-xl bg-[#fff8dc] p-4"><h3 className="text-lg font-black">{topic.title}</h3><p className="mt-2 text-sm leading-relaxed">{topic.body}</p></article>)}</section>}
        {section === "patch-notes" && <section className="space-y-3">{PATCH_NOTES.map((entry) => <article key={entry.version} className="rounded-xl bg-[#fff8dc] p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-black">{entry.version}</h3><time className="text-sm opacity-70">{entry.date}</time></div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{entry.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></article>)}</section>}
        {section === "account" && <section className="rounded-xl bg-[#fff8dc] p-4"><div className="flex items-center gap-3">{avatar ? <img src={avatar} alt="" className="h-12 w-12 rounded-full" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8b875] text-xl">🌱</div>}<div><h3 className="font-black">{discord.user?.globalName ?? discord.user?.username ?? "Local Farmer"}</h3><p className="text-sm">Farm Level {farmLevel}</p></div></div><p className="mt-4 text-sm"><strong>Cloud/session:</strong> {sessionStatus}</p></section>}
      </div>
    </section>
  </div>;
}
