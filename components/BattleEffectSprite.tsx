"use client";

import { useEffect, useState } from "react";
import type { BattleEffectDefinition } from "@/lib/battle-effect-data";

export default function BattleEffectSprite({ effect, playbackKey }: { effect: BattleEffectDefinition; playbackKey: number }) {
  const [playback, setPlayback] = useState({ id: playbackKey, frame: 0 });
  const frameIndex = playback.id === playbackKey ? playback.frame : 0;
  const frame = effect.frames[Math.min(frameIndex, effect.frames.length - 1)];
  const scale = 2.5;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const advance = (current: number) => {
      if (current >= effect.frames.length - 1) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        const next = current + 1;
        setPlayback({ id: playbackKey, frame: next });
        advance(next);
      }, effect.frames[current].duration);
    };
    advance(0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [effect, playbackKey]);

  return <span className="relative block overflow-hidden" style={{ width: effect.frameWidth * scale, height: effect.frameHeight * scale }} aria-hidden="true">
    {/* Exact sprite-sheet cropping preserves the supplied pixel art. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="" src={effect.src} draggable={false} className="absolute max-w-none" style={{
      width: effect.sheetWidth * scale,
      height: effect.sheetHeight * scale,
      left: -frame.x * scale,
      top: -frame.y * scale,
      imageRendering: "pixelated",
    }} />
  </span>;
}
