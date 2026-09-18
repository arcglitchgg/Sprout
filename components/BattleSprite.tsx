"use client";

import { useEffect, useState } from "react";
import { getBattleAnimation } from "@/lib/battle-sprite-data";
import type { BattleAnimationName } from "@/lib/battle-sprite-data";
import { BATTLE_SPRITES } from "@/lib/sprite-data";
import type { Fighter } from "@/lib/game-types";

export function LegacyBattleSprite({ crop }: { crop: Fighter["crop"] }) {
  const sprite = BATTLE_SPRITES[crop];
  return <span className="relative block h-12 w-12 overflow-hidden" aria-hidden="true">
    {/* Sprite-sheet cropping needs an unoptimized image at its exact pixel scale. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="" src={sprite.src} draggable={false} className="absolute max-w-none" style={{ width: 288, height: 288, left: -sprite.x * 3, top: -sprite.y * 3, imageRendering: "pixelated" }} />
  </span>;
}

export default function BattleSprite({ fighter, animation = "idle", playbackKey, paused = false }: {
  fighter: Pick<Fighter, "crop" | "personality">;
  animation?: BattleAnimationName;
  playbackKey?: number | null;
  paused?: boolean;
}) {
  const metadata = getBattleAnimation(fighter.crop, fighter.personality, animation);
  const playbackId = `${fighter.crop}:${fighter.personality}:${animation}:${playbackKey ?? "rest"}`;
  const [playback, setPlayback] = useState({ id: playbackId, frame: 0 });
  const frame = playback.id === playbackId ? playback.frame : 0;

  useEffect(() => {
    if (!metadata || paused || metadata.frames.length < 2) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const advance = (current: number) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        const next = current + 1;
        if (next < metadata.frames.length) {
          setPlayback({ id: playbackId, frame: next });
          advance(next);
        } else if (metadata.loop) {
          setPlayback({ id: playbackId, frame: 0 });
          advance(0);
        }
      }, metadata.frameDurationsMs[current] ?? metadata.frameDurationsMs.at(-1) ?? 150);
    };
    advance(0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [metadata, paused, playbackId]);

  return <span className="battle-sprite-shell flex h-20 w-20 items-center justify-center" aria-hidden="true">
    {metadata ? <>
      {/* Local audited PNG frames retain nearest-neighbor rendering. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={metadata.frames[Math.min(frame, metadata.frames.length - 1)]} draggable={false} className="battle-clean-sprite h-20 w-20 object-contain" />
    </> : <LegacyBattleSprite crop={fighter.crop} />}
  </span>;
}
