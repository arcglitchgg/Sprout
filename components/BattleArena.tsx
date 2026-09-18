"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BattleState } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";
import { TRAINING_TEAM } from "@/lib/battle-data";
import { crops } from "@/lib/game-data";
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

export default function BattleArena({ battle, team, onProgress }: { battle: BattleState | null; team: (Fighter | undefined)[]; onProgress: (progress: BattlePresentationProgress) => void }) {
  const latest = useRef(battle);
  const cursor = useRef(0);
  const visibleLogCount = useRef(battle ? 1 : 0);
  const completionReported = useRef(false);
  const presenting = useRef(false);
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "action" | "reaction" | "intercept-return" | "recovery">("idle");
  const [reaction, setReaction] = useState<"hurt" | "ko" | null>(null);
  const [dialogue, setDialogue] = useState<{ id: string; text: string; expires: number } | null>(null);
  const initialHp = Object.fromEntries((battle?.combatants ?? []).map((fighter) => [fighter.id, fighter.hp]));
  const displayHpRef = useRef<Record<string, number>>(initialHp);
  const [displayHp, setDisplayHp] = useState<Record<string, number>>(initialHp);
  useEffect(() => { latest.current = battle; }, [battle]);
  // This scheduler only consumes recorded decisions. It never advances or writes combat state.
  useEffect(() => {
    let cancelled = false;
    const delay = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

    async function present(index: number, current: BattleState) {
      presenting.current = true;
      const decision = current.decisions[index];
      const actor = current.combatants.find((fighter) => fighter.id === decision.actorId);
      const intended = current.combatants.find((fighter) => fighter.id === decision.intendedTargetId);
      const recipient = current.combatants.find((fighter) => fighter.id === decision.actualTargetId);
      const intercepted = Boolean(recipient && intended && recipient.id !== intended.id);
      let dialogueText: string | undefined;
      setActive(index);

      if (actor) {
        const prefix = `${actor.side === "player" ? "Your" : "Enemy"} ${crops[actor.crop].name} (${actor.slot + 1}): `;
        const line = current.log.find((event) => event.at === decision.at && event.message.startsWith(prefix));
        dialogueText = line?.message.slice(prefix.length);
      }

      const actionDuration = decision.chosenAction === "basic" ? NORMAL_ACTION_DURATION_MS : SKILL_ACTION_DURATION_MS;
      const impactAt = decision.chosenAction === "basic" ? 800 : 1150;
      setPhase("action");
      await delay(impactAt);
      if (cancelled) return;

      let nextHp: number | undefined;
      if (actor && recipient) {
        const prefix = `${actor.side === "player" ? "Your" : "Enemy"} ${crops[actor.crop].name} (${actor.slot + 1})`;
        const actionName = ACTIONS[decision.chosenAction].name;
        const actionLogIndex = current.log.findIndex((event, logIndex) =>
          logIndex >= visibleLogCount.current && event.at === decision.at && event.message.startsWith(`${prefix} uses ${actionName} `)
        );
        const actionLine = actionLogIndex >= 0 ? current.log[actionLogIndex].message : "";
        const damage = Number(actionLine.match(/ for (\d+)\.$/)?.[1] ?? 0);
        if (damage > 0) {
          nextHp = Math.max(0, (displayHpRef.current[decision.actualTargetId] ?? recipient.hp) - damage);
          displayHpRef.current = { ...displayHpRef.current, [decision.actualTargetId]: nextHp };
          setDisplayHp(displayHpRef.current);
          setReaction(nextHp === 0 ? "ko" : "hurt");
        }
        if (actionLogIndex >= 0) {
          let logCount = actionLogIndex + 1;
          while (logCount < current.log.length && current.log[logCount].at === decision.at) {
            const message = current.log[logCount].message;
            if (message.includes(" uses ") || message.includes(" intercepts ") || message.startsWith("Battle ended:") || message.startsWith("Time limit reached:")) break;
            logCount += 1;
          }
          visibleLogCount.current = logCount;
        }
      }
      setPhase("reaction");
      if (actor && dialogueText) setDialogue({ id: actor.id, text: dialogueText, expires: performance.now() + DIALOGUE_DURATION_MS });
      onProgress({ elapsed: decision.at, logCount: visibleLogCount.current, complete: false });

      const actionRemaining = actionDuration - impactAt;
      const reactionDuration = nextHp === 0 ? KO_REACTION_DURATION_MS : nextHp === undefined ? 0 : HURT_REACTION_DURATION_MS;
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
      if (cursor.current >= current.decisions.length) {
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
    ...TRAINING_TEAM.map((fighter, slot) => ({ ...fighter, side: "enemy" as const, slot, currentHp: fighter.hp })),
  ];
  const event = active === null ? undefined : battle?.decisions[active];
  const actor = fighters.find((fighter) => fighter.id === event?.actorId);
  const recipient = fighters.find((fighter) => fighter.id === event?.actualTargetId);
  const intended = fighters.find((fighter) => fighter.id === event?.intendedTargetId);
  const intercept = recipient && intended && recipient.id !== intended.id;
  const destination = intercept ? intended : recipient;
  const actionAnimation = event?.chosenAction === "basic" ? "normal-attack" as const : "skill" as const;
  const showingAction = phase === "action" || phase === "reaction";
  const showingIntercept = Boolean(intercept && (showingAction || phase === "intercept-return"));
  const travel = (from: PlacedFighter, to: PlacedFighter): CSSProperties => ({
    left: `${position(from).x}%`, top: `${position(from).y}%`,
    "--travel-x": `${position(to).x - position(from).x}cqw`,
    "--travel-y": `${position(to).y - position(from).y}cqh`,
  } as CSSProperties);

  return <div className="battle-arena relative h-[440px] overflow-hidden rounded-2xl border-4 border-[#637a45] bg-[#b7cc8b] text-[#2f3e2f]" aria-label="3 versus 3 battlefield">
    <div className="absolute inset-x-4 top-3 flex justify-between text-sm font-bold"><span>Your garden</span><span>Training rivals</span></div>
    <div className="absolute inset-y-14 left-1/2 border-l-2 border-dashed border-[#637a45]/30" />
    {fighters.map((fighter) => <div key={fighter.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${position(fighter).x}%`, top: `${position(fighter).y}%` }}>
      <BattleFighter fighter={fighter} hp={fighter.currentHp} slot={fighter.slot}
        animationKey={active}
        dialogue={dialogue?.id === fighter.id ? dialogue.text : undefined}
        impact={phase === "reaction" && reaction === "hurt" && !intercept && event?.actualTargetId === fighter.id ? event.chosenAction === "heavy-slam" ? "battle-impact-heavy" : "battle-impact" : undefined}
        shield={false}
        animation={showingAction && event?.actorId === fighter.id && event.chosenAction === "kernel-burst" ? actionAnimation : undefined}
        moving={Boolean(event && (showingAction && actor?.id === fighter.id && event.chosenAction !== "kernel-burst" || showingIntercept && recipient?.id === fighter.id))} />
    </div>)}
    {showingAction && event && actor && destination && <div key={`action-${active}`} className={`battle-traveler battle-${event.chosenAction}`} style={travel(actor, destination)} aria-hidden="true">
      {event.chosenAction === "kernel-burst" ? <span className="text-2xl text-yellow-300 [text-shadow:1px_1px_#634020]">● · ●</span> : <BattleSprite fighter={actor} animation={actionAnimation} playbackKey={active} />}
    </div>}
    {showingIntercept && event && intercept && <div key={`guard-${active}`} className={`battle-traveler ${phase === "intercept-return" ? "battle-intercept-return" : "battle-intercept-engage"}`} style={travel(recipient, intended)} aria-hidden="true">
      <div className={`${phase === "reaction" && reaction === "hurt" ? event.chosenAction === "heavy-slam" ? "battle-impact-heavy" : "battle-impact" : ""} ${recipient.currentHp === 0 ? "battle-ko" : ""}`}>
        <BattleSprite fighter={recipient} animation="guard" playbackKey={active} />
      </div>
      <span className="absolute -top-3 right-0">🛡️</span>
    </div>}
    <div className="absolute inset-x-0 bottom-3 text-center text-xs font-bold">{event ? ACTIONS[event.chosenAction].name : "Frontline in the center · rear fighters on the flanks"}</div>
  </div>;
}
