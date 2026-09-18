"use client";

import { useEffect, useRef, useState } from "react";
import { advanceBattle, createBattle } from "@/lib/battle";
import type { BattleState } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";

export function useBattle() {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const startedAt = useRef(0);
  const running = useRef(false);
  const status = battle?.status;

  useEffect(() => {
    if (status !== "running") { running.current = false; return; }
    const interval = setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      setBattle((current) => current ? advanceBattle(current, elapsed) : current);
    }, 100);
    return () => clearInterval(interval);
  }, [status]);

  function startBattle(team: Fighter[]) {
    if (running.current) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const next = createBattle(team, crypto.randomUUID(), seed);
    running.current = true;
    startedAt.current = performance.now();
    setBattle(next);
  }

  return { battle, startBattle };
}
