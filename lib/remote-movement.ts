import type { WorldPlayer } from "@/lib/social-types";

export const MOVEMENT_SEND_MS = 110;
export const WORLD_MOVEMENT_BOUNDS = { width: 1447, height: 1087 };

export type RemoteMovementPacket = {
  userId: string; seq: number; x: number; y: number;
  facing: "left" | "right"; moving: boolean; timestamp: number;
};

export type RemoteMovement = RemoteMovementPacket & {
  currentX: number; currentY: number; targetX: number; targetY: number;
  lastSeq: number; lastReceivedAt: number;
};

export function validMovementPacket(value: unknown): value is RemoteMovementPacket {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<RemoteMovementPacket>;
  return typeof p.userId === "string" && /^\d{5,25}$/.test(p.userId)
    && Number.isSafeInteger(p.seq) && p.seq! >= 0
    && typeof p.x === "number" && Number.isFinite(p.x) && p.x >= 0 && p.x <= WORLD_MOVEMENT_BOUNDS.width
    && typeof p.y === "number" && Number.isFinite(p.y) && p.y >= 0 && p.y <= WORLD_MOVEMENT_BOUNDS.height
    && (p.facing === "left" || p.facing === "right") && typeof p.moving === "boolean"
    && Number.isSafeInteger(p.timestamp) && p.timestamp! >= 0;
}

export function shouldSendMovement(previous: Pick<RemoteMovementPacket, "facing" | "moving"> | null, elapsedMs: number, next: Pick<RemoteMovementPacket, "facing" | "moving">) {
  return !previous || next.moving !== previous.moving || next.facing !== previous.facing || (next.moving && elapsedMs >= MOVEMENT_SEND_MS);
}

export function interpolateRemote(current: Pick<RemoteMovement, "currentX" | "currentY" | "targetX" | "targetY">, deltaMs: number) {
  const distance = Math.hypot(current.targetX - current.currentX, current.targetY - current.currentY);
  if (distance > 250) return { x: current.currentX + (current.targetX - current.currentX) * 0.35, y: current.currentY + (current.targetY - current.currentY) * 0.35 };
  const fraction = Math.min(1, Math.max(0, deltaMs) / 125);
  return { x: current.currentX + (current.targetX - current.currentX) * fraction, y: current.currentY + (current.targetY - current.currentY) * fraction };
}

export function createRemoteMovementStore() {
  const players = new Map<string, RemoteMovement>();
  const listeners = new Set<() => void>();
  let snapshot: RemoteMovement[] = [];
  const publish = () => { snapshot = [...players.values()].map((player) => ({ ...player })); listeners.forEach((listener) => listener()); };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot() { return snapshot; },
    apply(value: unknown, presentIds: ReadonlySet<string>, localId: string, receivedAt: number) {
      if (!validMovementPacket(value) || value.userId === localId || !presentIds.has(value.userId)) return false;
      const old = players.get(value.userId);
      if (old && value.seq <= old.lastSeq) return false;
      players.set(value.userId, {
        ...value, currentX: old?.currentX ?? value.x, currentY: old?.currentY ?? value.y,
        targetX: value.x, targetY: value.y, lastSeq: value.seq, lastReceivedAt: receivedAt,
      });
      publish();
      return true;
    },
    retain(presentIds: ReadonlySet<string>) {
      let changed = false;
      for (const id of players.keys()) if (!presentIds.has(id)) { players.delete(id); changed = true; }
      if (changed) publish();
    },
    remove(id: string) { if (players.delete(id)) publish(); },
    clear() { if (players.size) { players.clear(); publish(); } },
    tick(deltaMs: number, now: number) {
      let changed = false;
      for (const player of players.values()) {
        const next = interpolateRemote(player, deltaMs);
        if (Math.abs(next.x - player.currentX) > 0.05 || Math.abs(next.y - player.currentY) > 0.05) {
          player.currentX = next.x; player.currentY = next.y; changed = true;
        }
        if (player.moving && now - player.lastReceivedAt > 500) { player.moving = false; changed = true; }
      }
      if (changed) publish();
    },
  };
}

export type RemoteMovementStore = ReturnType<typeof createRemoteMovementStore>;

export function remoteWorldPlayer(remote: RemoteMovement, displayName: string, ownerId: string): WorldPlayer {
  return { userId: remote.userId, displayName, x: remote.currentX, y: remote.currentY,
    facing: remote.facing, moving: remote.moving, isOwner: remote.userId === ownerId,
    isLocal: false, online: true };
}
