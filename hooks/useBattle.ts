"use client";

import { useRef, useState } from "react";
import { createBattle, resolveBattle } from "@/lib/battle";
import type { BattleState } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";

export function useBattle() {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const running = useRef(false);

  function startBattle(team: Fighter[], enemyTeam?: Fighter[]) {
    if (running.current) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const next = resolveBattle(createBattle(team, crypto.randomUUID(), seed, enemyTeam));
    running.current = true;
    setBattle(next);
    running.current = false;
  }

  return { battle, startBattle };
}
