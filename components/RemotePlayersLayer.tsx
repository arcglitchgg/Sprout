"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import WorldPlayerEntity from "@/components/WorldPlayerEntity";
import { FARMER_ANIMATION } from "@/lib/sprite-data";
import { remoteWorldPlayer, type RemoteMovementStore } from "@/lib/remote-movement";
import { playerName } from "@/lib/challenges";
import type { WorldPlayer } from "@/lib/social-types";

export default function RemotePlayersLayer({ store, localId, ownerId, ownerName, ownerFallback, ownerOnline, reconnectingIds, profiles, labelScale, onInteract }: {
  store: RemoteMovementStore; localId: string | null; ownerId: string | null;
  ownerName: string | null; ownerFallback: { x: number; y: number };
  profiles: Record<string, { displayName: string | null; username: string }>;
  ownerOnline: boolean; reconnectingIds: string[]; labelScale: number; onInteract: (player: WorldPlayer) => void;
}) {
  const remotes = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [frameIndex, setFrameIndex] = useState(0);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastSprite = last;
    const tick = (now: number) => {
      store.tick(Math.min(now - last, 50), Date.now());
      last = now;
      if (now - lastSprite >= FARMER_ANIMATION.frameMs) {
        lastSprite = now;
        setFrameIndex((index) => (index + 1) % FARMER_ANIMATION.walkFrames.length);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [store]);

  const players = remotes.filter((remote) => remote.userId !== localId && (remote.userId !== ownerId || ownerOnline))
    .map((remote) => ({
      ...remoteWorldPlayer(remote, playerName(remote.userId, profiles, ownerId ? { userId: ownerId, displayName: ownerName } : null), ownerId ?? ""),
      reconnecting: reconnectingIds.includes(remote.userId),
      frame: remote.moving ? FARMER_ANIMATION.walkFrames[frameIndex] : FARMER_ANIMATION.idleFrame,
    }));
  if (ownerId && !players.some((player) => player.userId === ownerId)) {
    players.push({ userId: ownerId, displayName: ownerName ?? "Farm owner", ...ownerFallback,
      facing: "left", isOwner: true, isLocal: false, online: ownerOnline, reconnecting: reconnectingIds.includes(ownerId),
      moving: false, frame: FARMER_ANIMATION.idleFrame });
  }
  return <div className="pointer-events-none absolute inset-0 z-30">
    {players.sort((a, b) => a.y - b.y || a.userId.localeCompare(b.userId))
      .map((player) => <WorldPlayerEntity key={player.userId} player={player} onInteract={onInteract} labelScale={labelScale} />)}
  </div>;
}
