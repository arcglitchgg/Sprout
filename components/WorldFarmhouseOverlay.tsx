"use client";

import { useState } from "react";
import CollectionBook from "@/components/CollectionBook";
import FighterCard from "@/components/FighterCard";
import HarvestedCropCard from "@/components/HarvestedCropCard";
import TeamSelector from "@/components/TeamSelector";
import { AWAKENING_COSTS } from "@/lib/awakening";
import { ASCENSION_HARD_PITY, FUSION_UPGRADE_CHANCE, getFusionEligibility } from "@/lib/fusion";
import { crops, mutations } from "@/lib/game-data";
import { FUSION_RARITIES, FUSION_SPECIES, getFusionRosterGroups, getReleaseConfirmationCount } from "@/lib/fighter-roster";
import type { ActiveTeam, AscensionPity, CollectionEntry, CropType, Fighter, HarvestedCrop, HarvestMutationType, MutationType } from "@/lib/game-types";

const nextTier: Record<HarvestMutationType, string> = { normal: "Large", large: "Golden", golden: "Prismatic", prismatic: "Ascended" };
type FarmhouseTab = "collection" | "fighters" | "active team" | "harvested crops" | "fusion";
type Props = { collection: CollectionEntry[]; coins: number; fighters: Fighter[]; activeTeam: ActiveTeam; ascensionPity: AscensionPity; harvestedCrops: HarvestedCrop[]; awakenCrop: (itemId: string) => void; fuseFighters: (selectedIds: string[]) => Fighter | null; setFighterLocked: (fighterId: string, locked: boolean) => boolean; releaseFighter: (fighterId: string) => boolean; setActiveTeam: (fighterIds: string[]) => boolean; onClose: () => void };

export default function WorldFarmhouseOverlay({ collection, coins, fighters, activeTeam, ascensionPity, harvestedCrops, awakenCrop, fuseFighters, setFighterLocked, releaseFighter, setActiveTeam, onClose }: Props) {
  const [tab, setTab] = useState<FarmhouseTab>("collection");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fusionResult, setFusionResult] = useState<Fighter | null>(null);
  const [openGroup, setOpenGroup] = useState<{ mutation: MutationType; crop: CropType } | null>(null);
  const [releaseConfirmation, setReleaseConfirmation] = useState<{ fighterId: string; step: number } | null>(null);
  const existingIds = new Set(fighters.map((fighter) => fighter.id));
  const selected = selectedIds.filter((id) => existingIds.has(id));
  const eligibility = getFusionEligibility(fighters, selected);
  const firstSelected = fighters.find((fighter) => fighter.id === selected[0]);
  const groups = getFusionRosterGroups(fighters);
  const activeGroup = openGroup ? groups.find((group) => group.mutation === openGroup.mutation && group.crop === openGroup.crop) ?? null : null;

  function toggleFighter(id: string) {
    const fighter = fighters.find((entry) => entry.id === id);
    if (!fighter || fighter.locked || fighter.mutation === "ascended") return;
    setFusionResult(null);
    setSelectedIds((current) => { const valid = current.filter((selectedId) => existingIds.has(selectedId)); return valid.includes(id) ? valid.filter((selectedId) => selectedId !== id) : valid.length < 4 ? [...valid, id] : valid; });
  }
  function performFusion() { if (!eligibility.valid) return; const result = fuseFighters(selected); if (result) { setSelectedIds([]); setFusionResult(result); } }
  function confirmRelease() {
    if (!releaseConfirmation) return;
    const fighter = fighters.find((entry) => entry.id === releaseConfirmation.fighterId);
    if (!fighter || fighter.locked) { setReleaseConfirmation(null); return; }
    if (releaseConfirmation.step < getReleaseConfirmationCount(fighter.mutation)) { setReleaseConfirmation({ ...releaseConfirmation, step: releaseConfirmation.step + 1 }); return; }
    releaseFighter(fighter.id); setSelectedIds((current) => current.filter((id) => id !== fighter.id)); setReleaseConfirmation(null);
  }
  function closeFarmhouse() { setSelectedIds([]); setFusionResult(null); setReleaseConfirmation(null); onClose(); }

  return <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="farmhouse-title">
    <section className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-[#765438] bg-[#efe2b8] text-[#2f3e2f] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#765438]/35 bg-[#d8b875] px-4 py-3"><div><h2 id="farmhouse-title" className="text-xl font-bold sm:text-2xl">Farmhouse</h2><p className="text-xs opacity-70 sm:text-sm">Your discoveries and awakened fighters.</p></div><button type="button" onClick={closeFarmhouse} className="rounded-lg bg-[#fff8dc] px-3 py-2 font-bold shadow-sm hover:bg-white">Close</button></header>
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[#765438]/25 bg-[#e5cf98] px-3 pt-3" role="tablist" aria-label="Farmhouse sections">{(["collection", "fighters", "active team", "harvested crops", "fusion"] as FarmhouseTab[]).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setReleaseConfirmation(null); }} className={`shrink-0 rounded-t-lg px-3 py-2 text-sm font-bold capitalize ${tab === value ? "bg-[#fff8dc]" : "bg-[#c8aa6a] hover:bg-[#d4ba80]"}`}>{value}{value === "fighters" ? ` (${fighters.length})` : value === "harvested crops" ? ` (${harvestedCrops.length})` : ""}</button>)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {tab === "collection" ? <CollectionBook collection={collection} /> : tab === "active team" ? <ActiveTeamEditor fighters={fighters} activeTeam={activeTeam} setActiveTeam={setActiveTeam} /> : tab === "harvested crops" ? <HarvestedSection coins={coins} items={harvestedCrops} awakenCrop={awakenCrop} /> : tab === "fusion" ? <FusionPanel groups={groups} activeGroup={activeGroup} setOpenGroup={(group) => { setOpenGroup(group); setSelectedIds([]); setFusionResult(null); }} selected={selected} firstSelected={firstSelected} eligibility={eligibility} fusionResult={fusionResult} ascensionPity={ascensionPity} toggleFighter={toggleFighter} performFusion={performFusion} clear={() => setSelectedIds([])} /> : <Roster fighters={fighters} setFighterLocked={setFighterLocked} requestRelease={(fighterId) => setReleaseConfirmation({ fighterId, step: 1 })} />}
      </div>
      {releaseConfirmation && <ReleaseConfirmation fighters={fighters} confirmation={releaseConfirmation} onConfirm={confirmRelease} onCancel={() => setReleaseConfirmation(null)} />}
    </section>
  </div>;
}

function ActiveTeamEditor({ fighters, activeTeam, setActiveTeam }: { fighters: Fighter[]; activeTeam: ActiveTeam; setActiveTeam: (ids: string[]) => boolean }) {
  const selected = activeTeam.map((id) => id ?? "");
  return <div className="rounded-xl bg-[#fff8dc] p-4"><h3 className="text-lg font-black">Active Team</h3><p className="text-sm">Your default ordered team for Dungeon and PvP. Locked fighters are allowed.</p><TeamSelector fighters={fighters} selected={selected} onSelect={setActiveTeam} locked={false} />{selected.some((id) => !id) && <p className="mt-2 text-sm font-bold text-[#8b2f24]">Active Team needs updating before it can be used automatically.</p>}</div>;
}

function HarvestedSection({ coins, items, awakenCrop }: { coins: number; items: HarvestedCrop[]; awakenCrop: (id: string) => void }) {
  if (!items.length) return <div className="rounded-xl bg-[#fff8dc] p-5 text-sm opacity-70">Harvest crops before awakening them into fighters.</div>;
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{items.map((item) => { const cost = AWAKENING_COSTS[item.mutation]; const shortfall = Math.max(0, cost - coins); return <HarvestedCropCard key={item.id} item={item} actionLabel="Awaken" actionDetail={shortfall ? `Cost: ${cost} · Need ${shortfall} more` : `Cost: ${cost} coins`} actionDisabled={shortfall > 0} onAction={awakenCrop} />; })}</div>;
}

function Roster({ fighters, setFighterLocked, requestRelease }: { fighters: Fighter[]; setFighterLocked: (id: string, locked: boolean) => boolean; requestRelease: (id: string) => void }) {
  if (!fighters.length) return <div className="rounded-xl bg-[#fff8dc] p-5 text-sm opacity-70">Awaken a harvested crop to create your first fighter.</div>;
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{fighters.map((fighter) => <div key={fighter.id} className="rounded-xl bg-[#fff8dc]"><FighterCard fighter={fighter} /><div className="flex gap-2 px-4 pb-3"><button type="button" onClick={() => setFighterLocked(fighter.id, !fighter.locked)} className="rounded-lg border border-[#765438]/40 px-3 py-1 text-xs font-bold">{fighter.locked ? "🔒 Unlock" : "🔓 Lock"}</button><button type="button" onClick={() => requestRelease(fighter.id)} disabled={fighter.locked} className="rounded-lg border border-[#9b3d2f]/50 px-3 py-1 text-xs font-bold text-[#8b2f24] disabled:cursor-not-allowed disabled:opacity-40">Release</button></div></div>)}</div>;
}

function FusionPanel({ groups, activeGroup, setOpenGroup, selected, firstSelected, eligibility, fusionResult, ascensionPity, toggleFighter, performFusion, clear }: { groups: ReturnType<typeof getFusionRosterGroups>; activeGroup: ReturnType<typeof getFusionRosterGroups>[number] | null; setOpenGroup: (group: { mutation: MutationType; crop: CropType } | null) => void; selected: string[]; firstSelected?: Fighter; eligibility: ReturnType<typeof getFusionEligibility>; fusionResult: Fighter | null; ascensionPity: AscensionPity; toggleFighter: (id: string) => void; performFusion: () => void; clear: () => void }) {
  return <div className="relative min-h-full pb-32">
    {fusionResult && <div className="mb-3 rounded-xl border-2 border-[#4f772d] bg-[#e6f3c8] p-3" role="status"><h3 className="mb-2 font-bold">Fusion complete — new fighter</h3><FighterCard fighter={fusionResult} /></div>}
    {!activeGroup ? <div className="space-y-4">{FUSION_RARITIES.map((mutation) => <section key={mutation}><h3 className="mb-2 text-lg font-black">{mutations[mutation].name}</h3><div className="grid gap-2 sm:grid-cols-3">{FUSION_SPECIES.map((crop) => { const group = groups.find((entry) => entry.mutation === mutation && entry.crop === crop)!; return <button key={`${mutation}:${crop}`} type="button" onClick={() => setOpenGroup({ mutation, crop })} className="rounded-xl border-2 border-[#765438]/25 bg-[#fff8dc] p-3 text-left hover:border-[#4f772d]"><strong>{mutations[mutation].name} {crops[crop].name}</strong><span className="mt-1 block text-xs">{group.ownedCount} owned</span><span className="block text-xs font-bold text-[#4f772d]">{mutation === "ascended" ? "Cannot fuse further" : `${group.fusionCount} fusion${group.fusionCount === 1 ? "" : "s"} available`}</span></button>; })}</div></section>)}</div> : <div><button type="button" onClick={() => setOpenGroup(null)} className="mb-3 rounded-lg border border-[#765438]/40 bg-[#fff8dc] px-3 py-2 text-sm font-bold">← All Fusion groups</button><h3 className="text-lg font-black">{mutations[activeGroup.mutation].name} {crops[activeGroup.crop].name}</h3><p className="mb-3 text-sm">{activeGroup.ownedCount} owned · {activeGroup.eligibleCount} unlocked and eligible</p>{activeGroup.fighters.length === 0 ? <p className="rounded-xl bg-[#fff8dc] p-4 text-sm">No fighters in this group.</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{activeGroup.fighters.map((fighter) => { const unavailable = fighter.locked || fighter.mutation === "ascended"; const chosen = selected.includes(fighter.id); return <button key={fighter.id} type="button" onClick={() => toggleFighter(fighter.id)} disabled={unavailable || (!chosen && selected.length === 4)} aria-pressed={chosen} className={`rounded-xl border-2 text-left disabled:cursor-not-allowed ${chosen ? "border-[#4f772d] bg-[#d9ed92]" : "border-transparent"} ${unavailable ? "opacity-55" : "hover:border-[#4f772d]/60"}`}><FighterCard fighter={fighter} /><span className="block px-3 pb-2 text-xs font-bold">{fighter.locked ? "Locked · unavailable" : fighter.mutation === "ascended" ? "Ascended cannot fuse further" : chosen ? "✓ Selected" : "Select fighter"}</span></button>; })}</div>}</div>}
    <div className="sticky bottom-0 mt-4 rounded-xl border-2 border-[#765438] bg-[#fff8dc]/95 p-3 text-sm shadow-xl backdrop-blur-sm"><div className="flex items-center justify-between gap-2"><strong>{selected.length} / 4 selected</strong><button type="button" onClick={clear} disabled={!selected.length} className="text-xs font-bold underline disabled:opacity-40">Clear</button></div><p className="font-bold">{firstSelected ? `${mutations[firstSelected.mutation].name} ${crops[firstSelected.crop].name}` : activeGroup ? `${mutations[activeGroup.mutation].name} ${crops[activeGroup.crop].name}` : "Choose a rarity and species"}</p>{firstSelected?.mutation === "prismatic" && <p className="text-xs font-bold">Ascension: {ascensionPity[firstSelected.crop] + 1} / {ASCENSION_HARD_PITY}{ascensionPity[firstSelected.crop] >= ASCENSION_HARD_PITY - 1 ? " · Next Ascension guaranteed" : ""}</p>}{firstSelected && firstSelected.mutation !== "ascended" && <p className="text-xs">{firstSelected.mutation === "prismatic" && ascensionPity[firstSelected.crop] >= ASCENSION_HARD_PITY - 1 ? "100% Ascended" : `${Math.round((1 - FUSION_UPGRADE_CHANCE[firstSelected.mutation]) * 100)}% ${mutations[firstSelected.mutation].name} · ${Math.round(FUSION_UPGRADE_CHANCE[firstSelected.mutation] * 100)}% ${nextTier[firstSelected.mutation]}`}</p>}<button type="button" onClick={performFusion} disabled={!eligibility.valid} className="mt-2 w-full rounded-lg bg-[#4f772d] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Fuse Fighters</button>{!eligibility.valid && selected.length > 0 && <p className="mt-1 text-xs text-[#7b3e20]">{eligibility.reason}</p>}</div>
  </div>;
}

function ReleaseConfirmation({ fighters, confirmation, onConfirm, onCancel }: { fighters: Fighter[]; confirmation: { fighterId: string; step: number }; onConfirm: () => void; onCancel: () => void }) {
  const fighter = fighters.find((entry) => entry.id === confirmation.fighterId); if (!fighter) return null;
  const finalStep = confirmation.step >= getReleaseConfirmationCount(fighter.mutation); const rare = fighter.mutation === "golden" || fighter.mutation === "prismatic" || fighter.mutation === "ascended";
  const warning = confirmation.step === 1 && getReleaseConfirmationCount(fighter.mutation) === 2 ? "This very rare fighter will be permanently removed. Continue to the final confirmation?" : fighter.mutation === "golden" ? "Golden fighters are rare. This permanently removes the fighter and gives no reward." : "This permanently removes the fighter and gives no reward.";
  return <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 p-4" role="alertdialog" aria-modal="true"><div className="w-full max-w-sm rounded-xl border-2 border-[#765438] bg-[#fff8dc] p-5 shadow-2xl"><h3 className="text-lg font-black">Release {mutations[fighter.mutation].name} {crops[fighter.crop].name}?</h3><p className={`mt-2 text-sm ${rare ? "font-bold text-[#8b2f24]" : ""}`}>{warning}</p><div className="mt-4 flex gap-2"><button type="button" onClick={onConfirm} className="rounded-lg bg-[#8b2f24] px-3 py-2 font-bold text-white">{finalStep ? "Release permanently" : "Continue"}</button><button type="button" onClick={onCancel} className="rounded-lg border border-[#765438] px-3 py-2 font-bold">Cancel</button></div></div></div>;
}
