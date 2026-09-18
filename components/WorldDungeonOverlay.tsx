"use client";

import { useCallback, useEffect, useRef } from "react";
import Battle from "@/components/Battle";
import type { BattleState } from "@/lib/battle-types";
import type { Fighter } from "@/lib/game-types";

export default function WorldDungeonOverlay({ fighters, onVictory, onClose }: {
  fighters: Fighter[];
  onVictory: (result: BattleState) => void;
  onClose: () => void;
}) {
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishBattle = useCallback(() => {
    if (returnTimer.current) return;
    returnTimer.current = setTimeout(onClose, 1200);
  }, [onClose]);

  useEffect(() => () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0b0f0c]/90 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Dungeon battle">
      <div className="mx-auto max-w-5xl">
        <div className="sticky top-0 z-10 flex justify-end pb-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/20 bg-[#252d27] px-4 py-2 font-bold text-[#f4e8c1]">Return to world</button>
        </div>
        <Battle fighters={fighters} onVictory={onVictory} onComplete={finishBattle} />
      </div>
    </div>
  );
}
