"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BattleState, BattleVisualActionEvent } from "@/lib/battle-types";
import { applyBattleVisualEvent, createBattlePlayback } from "@/lib/battle-playback";
import type { Fighter } from "@/lib/game-types";
import { TRAINING_TEAM } from "@/lib/battle-data";
import { ACTIONS } from "@/lib/skill-data";
import BattleFighter from "@/components/BattleFighter";
import BattleSprite from "@/components/BattleSprite";
import "./battle-arena.css";

type PlacedFighter = Fighter & { side: "player" | "enemy"; slot: number; currentHp: number };
export type BattlePresentationProgress = { elapsed: number; logCount: number; complete: boolean };
export const DIALOGUE_DURATION_MS = 1500;
export const NORMAL_ACTION_DURATION_MS = 1300;
export const SKILL_ACTION_DURATION_MS = 1900;
export const INTERCEPT_ENGAGE_DURATION_MS = 350;
export const INTERCEPT_RETURN_DURATION_MS = 400;
export const HURT_REACTION_DURATION_MS = 350;
export const KO_REACTION_DURATION_MS = 900;
export const RECOVERY_DURATION_MS = 500;
const PRESENTATION_POLL_MS = 50;
const position = (fighter: PlacedFighter) => ({
  x: fighter.side === "player" ? (fighter.slot === 0 ? 36 : 13) : (fighter.slot === 0 ? 64 : 87),
  y: fighter.slot === 0 ? 49 : fighter.slot === 1 ? 24 : 75,
});

export default function BattleArena({ battle, team, previewEnemyTeam = TRAINING_TEAM, onProgress, sideLabels = ["Your garden", "Training rivals"] }: { battle: BattleState | null; team: (Fighter | undefined)[]; previewEnemyTeam?: Fighter[]; onProgress: (progress: BattlePresentationProgress) => void; sideLabels?: [string, string] }) {
  const latest = useRef(battle);
  const cursor = useRef(0);
  const visibleLogCount = useRef(0);
  const completionReported = useRef(false);
  const presenting = useRef(false);
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "action" | "reaction" | "intercept-return" | "recovery">("idle");
  const [reaction, setReaction] = useState<"hurt" | "ko" | null>(null);
  const [dialogue, setDialogue] = useState<{ id: string; text: string; expires: number } | null>(null);
  const initialHp = battle ? createBattlePlayback(battle).displayedHp : {};
  const displayHpRef = useRef<Record<string, number>>(initialHp);
  const [displayHp, setDisplayHp] = useState<Record<string, number>>(initialHp);
  useEffect(() => { latest.current = battle; }, [battle]);
  // This scheduler only consumes immutable visual events. It never advances combat state.
  useEffect(() => {
    let cancelled = false;
    const delay = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

    async function present(index: number, current: BattleState) {
      presenting.current = true;
      const event = current.visualEvents[index];
      if (event.type === "result") {
        const playback = applyBattleVisualEvent({ displayedHp: displayHpRef.current, visibleLogCount: visibleLogCount.current, visibleStatus: null, complete: false }, event);
        visibleLogCount.current = playback.visibleLogCount;
        completionReported.current = true;
        onProgress({ elapsed: event.simulatedTime, logCount: playback.visibleLogCount, complete: true });
        presenting.current = false;
        return;
      }
      const actor = current.combatants.find((fighter) => fighter.id === event.actorId);
      const intended = current.combatants.find((fighter) => fighter.id === event.intendedTargetId);
      const recipient = current.combatants.find((fighter) => fighter.id === event.actualTargetId);
      const intercepted = Boolean(event.interceptedById);
      setActive(index);
      const actionDuration = event.actionId === "basic" ? NORMAL_ACTION_DURATION_MS : SKILL_ACTION_DURATION_MS;
      const impactAt = event.actionId === "basic" ? 800 : 1150;
      setPhase("action");
      await delay(impactAt);
      if (cancelled) return;

      const playback = applyBattleVisualEvent({ displayedHp: displayHpRef.current, visibleLogCount: visibleLogCount.current, visibleStatus: null, complete: false }, event);
      displayHpRef.current = playback.displayedHp;
      visibleLogCount.current = playback.visibleLogCount;
      setDisplayHp(playback.displayedHp);
      setReaction(event.ko ? "ko" : "hurt");
      setPhase("reaction");
      if (actor && event.dialogue) setDialogue({ id: actor.id, text: event.dialogue, expires: performance.now() + DIALOGUE_DURATION_MS });
      onProgress({ elapsed: event.simulatedTime, logCount: visibleLogCount.current, complete: false });

      const actionRemaining = actionDuration - impactAt;
      const reactionDuration = event.ko ? KO_REACTION_DURATION_MS : HURT_REACTION_DURATION_MS;
      await delay(Math.max(actionRemaining, reactionDuration));
      if (cancelled) return;
      setReaction(null);
      if (intercepted) {
        setPhase("intercept-return");
        await delay(INTERCEPT_RETURN_DURATION_MS);
        if (cancelled) return;
      }
      setPhase("recovery");
      await delay(RECOVERY_DURATION_MS);
      if (cancelled) return;
      setActive(null);
      setPhase("idle");
      presenting.current = false;
    }

    const interval = setInterval(() => {
      const current = latest.current;
      if (!current) return;
      setDialogue((value) => value && value.expires <= performance.now() ? null : value);
      if (presenting.current) return;
      if (cursor.current >= current.visualEvents.length) {
        setActive(null);
        if (current.status !== "running" && !completionReported.current) {
          completionReported.current = true;
          visibleLogCount.current = current.log.length;
          onProgress({ elapsed: current.elapsed, logCount: current.log.length, complete: true });
        }
        return;
      }
      const index = cursor.current++;
      void present(index, current);
    }, PRESENTATION_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [onProgress]);

  const fighters: PlacedFighter[] = battle?.combatants.map((fighter) => ({ ...fighter, currentHp: displayHp[fighter.id] ?? fighter.hp })) ?? [
    ...team.flatMap((fighter, slot) => fighter ? [{ ...fighter, side: "player" as const, slot, currentHp: fighter.hp }] : []),
    ...previewEnemyTeam.map((fighter, slot) => ({ ...fighter, side: "enemy" as const, slot, currentHp: fighter.hp })),
  ];
  const queuedEvent = active === null ? undefined : battle?.visualEvents[active];
  const event: BattleVisualActionEvent | undefined = queuedEvent?.type === "action" ? queuedEvent : undefined;
  const actor = fighters.find((fighter) => fighter.id === event?.actorId);
  const recipient = fighters.find((fighter) => fighter.id === event?.actualTargetId);
  const intended = fighters.find((fighter) => fighter.id === event?.intendedTargetId);
  const intercept = recipient && intended && recipient.id !== intended.id;
  const destination = intercept ? intended : recipient;
  const actionAnimation = event?.actionId === "basic" ? "normal-attack" as const : "skill" as const;
  const showingAction = phase === "action" || phase === "reaction";
  const showingIntercept = Boolean(intercept && (showingAction || phase === "intercept-return"));
  const travel = (from: PlacedFighter, to: PlacedFighter): CSSProperties => ({
    left: `${position(from).x}%`, top: `${position(from).y}%`,
    "--travel-x": `${position(to).x - position(from).x}cqw`,
    "--travel-y": `${position(to).y - position(from).y}cqh`,
  } as CSSProperties);

  return <div className="battle-arena relative overflow-hidden rounded-2xl border-4 border-[#637a45] bg-[#b7cc8b] text-[#2f3e2f]" aria-label={`3 versus ${fighters.filter((fighter) => fighter.side === "enemy").length} battlefield`}>
    <div className="battle-side-labels absolute inset-x-4 top-3 flex justify-between gap-2 text-sm font-bold"><span className="min-w-0 truncate">{sideLabels[0]}</span><span className="min-w-0 truncate text-right">{sideLabels[1]}</span></div>
    <div className="absolute inset-y-14 left-1/2 border-l-2 border-dashed border-[#637a45]/30" />
    {fighters.map((fighter) => <div key={fighter.id} data-side={fighter.side} data-slot={fighter.slot} className="battle-fighter-position absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${position(fighter).x}%`, top: `${position(fighter).y}%` }}>
      <BattleFighter fighter={fighter} hp={fighter.currentHp} slot={fighter.slot} scale={fighter.visualScale}
        animationKey={active}
        dialogue={dialogue?.id === fighter.id ? dialogue.text : undefined}
        impact={phase === "reaction" && reaction === "hurt" && !intercept && event?.actualTargetId === fighter.id ? event.actionId === "heavy-slam" ? "battle-impact-heavy" : "battle-impact" : undefined}
        shield={false}
        animation={showingAction && event?.actorId === fighter.id && event.actionId === "kernel-burst" ? actionAnimation : undefined}
        moving={Boolean(event && (showingAction && actor?.id === fighter.id && event.actionId !== "kernel-burst" || showingIntercept && recipient?.id === fighter.id))} />
    </div>)}
    {showingAction && event && actor && destination && <div key={`action-${active}`} className={`battle-traveler battle-${event.actionId}`} style={travel(actor, destination)} aria-hidden="true">
      {event.actionId === "kernel-burst" ? <span className="text-2xl text-yellow-300 [text-shadow:1px_1px_#634020]">● · ●</span> : <span className="block" style={{ transform: `scale(${actor.visualScale ?? 1})`, transformOrigin: "bottom center" }}><BattleSprite fighter={actor} animation={actionAnimation} playbackKey={active} /></span>}
    </div>}
    {showingIntercept && event && intercept && <div key={`guard-${active}`} className={`battle-traveler ${phase === "intercept-return" ? "battle-intercept-return" : "battle-intercept-engage"}`} style={travel(recipient, intended)} aria-hidden="true">
      <div className={`${phase === "reaction" && reaction === "hurt" ? event.actionId === "heavy-slam" ? "battle-impact-heavy" : "battle-impact" : ""} ${recipient.currentHp === 0 ? "battle-ko" : ""}`}>
        <BattleSprite fighter={recipient} animation="guard" playbackKey={active} />
      </div>
      <span className="absolute -top-3 right-0">🛡️</span>
    </div>}
    <div className="absolute inset-x-0 bottom-3 text-center text-xs font-bold">{event ? ACTIONS[event.actionId].name : "Frontline in the center · rear fighters on the flanks"}</div>
  </div>;
}
