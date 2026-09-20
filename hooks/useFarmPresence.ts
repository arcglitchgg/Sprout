"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRealtimeClient, RealtimeTokenError, requestRealtimeToken } from "@/lib/realtime-client";
import { inspectRealtimeChannelError, realtimeErrorKind, realtimeStage, realtimeTransportEvent, safeRealtimeChannelError, safeRealtimeCloseReason, safeRealtimeHostname } from "@/lib/realtime-diagnostics";
import { shouldSendMovement, createRemoteMovementStore, type RemoteMovementPacket } from "@/lib/remote-movement";

export function farmRoom(ownerId: string) {
  if (!/^\d{5,25}$/.test(ownerId)) throw new Error("Invalid farm owner.");
  return `farm:${ownerId}`;
}

export function ownerIsPresent(state: Record<string, unknown[]>, ownerId: string) {
  return Object.values(state).some((entries) => entries.some((entry) =>
    !!entry && typeof entry === "object" && "userId" in entry && entry.userId === ownerId && "isOwner" in entry && entry.isOwner === true));
}

export function presentUserIds(state: Record<string, unknown[]>) {
  return [...new Set(Object.values(state).flatMap((entries) => entries.flatMap((entry) =>
    entry && typeof entry === "object" && "userId" in entry && typeof entry.userId === "string" && /^\d{5,25}$/.test(entry.userId) ? [entry.userId] : [])))].sort();
}

export function useFarmPresence(session: string | null, userId: string | null, ownerId: string | null) {
  const [ownerOnline, setOwnerOnline] = useState(false);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const remoteStore = useMemo(() => createRemoteMovementStore(), []);
  const latestLocal = useRef<Omit<RemoteMovementPacket, "userId" | "seq" | "timestamp"> | null>(null);
  const sendRef = useRef<((movement: NonNullable<typeof latestLocal.current>, force: boolean) => void) | null>(null);
  const updateLocalMovement = useCallback((movement: NonNullable<typeof latestLocal.current>) => {
    latestLocal.current = movement;
    sendRef.current?.(movement, false);
  }, []);
  useEffect(() => {
    if (!session || !userId || !ownerId) { remoteStore.clear(); realtimeStage("session-unavailable"); return; }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) { remoteStore.clear(); realtimeStage("browser-config-missing"); return; }
    let closed = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    async function connect() {
      cleanup?.();
      cleanup = undefined;
      setOwnerOnline(false);
      setPresentIds([]);
      remoteStore.clear();
      sendRef.current = null;
      try {
        realtimeStage("token-fetch-start");
        const credentials = await requestRealtimeToken(session!, controller.signal);
        if (closed) return;
        realtimeStage("token-received");
        const client = createRealtimeClient(credentials.token);
        if (!client) { realtimeStage("browser-config-missing"); return; }
        await client.realtime.setAuth(credentials.token);
        if (closed) return;
        realtimeStage("auth-set");
        if (process.env.NEXT_PUBLIC_REALTIME_DEBUG === "1") {
          const realtime = client.realtime;
          realtimeTransportEvent({
            hostname: typeof realtime.endpointURL === "function" ? safeRealtimeHostname(realtime.endpointURL()) : "unknown",
            webSocketAvailable: typeof window.WebSocket === "function",
            event: "connecting",
            state: typeof realtime.connectionState === "function" ? realtime.connectionState() : "unknown",
            closeCode: null,
            closeReason: null,
          });
          // Read-only socket observers. Do not inspect URLs, frames, or logger data.
          const observer = realtime as typeof realtime & { socketAdapter?: {
            onOpen: (callback: () => void) => void;
            onClose: (callback: (event: CloseEvent) => void) => void;
            onError: (callback: () => void) => void;
          } };
          observer.socketAdapter?.onOpen(() => { if (!closed) realtimeTransportEvent({ event: "open", state: realtime.connectionState() }); });
          observer.socketAdapter?.onClose((event) => { if (!closed) realtimeTransportEvent({ event: "close", state: realtime.connectionState(), closeCode: event.code, closeReason: safeRealtimeCloseReason(event.reason) }); });
          observer.socketAdapter?.onError(() => { if (!closed) realtimeTransportEvent({ event: "error", state: realtime.connectionState() }); });
        }
        const channel = client.channel(farmRoom(ownerId!), { config: { private: true, presence: { key: userId! } } });
        let subscribed = false;
        let lastSent: RemoteMovementPacket | null = null;
        let lastSentAt = 0;
        let sequence = 0;
        let members = new Set<string>();
        sendRef.current = (movement, force) => {
          if (!subscribed || closed || (!force && !shouldSendMovement(lastSent, Date.now() - lastSentAt, movement))) return;
          const timestamp = Date.now();
          sequence = Math.max(sequence + 1, timestamp * 1000);
          const packet: RemoteMovementPacket = { userId: userId!, seq: sequence, ...movement, timestamp };
          lastSent = packet;
          lastSentAt = timestamp;
          void channel.send({ type: "broadcast", event: "movement", payload: packet }).catch(() => {});
        };
        channel.on("broadcast", { event: "movement" }, ({ payload }) => {
          if (!closed) remoteStore.apply(payload, members, userId!, Date.now());
        });
        channel.on("presence", { event: "sync" }, () => {
          if (!closed) {
            const state = channel.presenceState() as Record<string, unknown[]>;
            setOwnerOnline(ownerIsPresent(state, ownerId!));
            const ids = presentUserIds(state);
            const joined = ids.some((id) => id !== userId && !members.has(id));
            members = new Set(ids);
            remoteStore.retain(members);
            setPresentIds(ids);
            if (joined && latestLocal.current) sendRef.current?.(latestLocal.current, true);
            realtimeStage("presence-synced", ids.length);
          }
        });
        channel.on("presence", { event: "join" }, ({ key }) => {
          if (key && key !== userId) remoteStore.remove(key);
          realtimeStage("presence-join");
        });
        channel.on("presence", { event: "leave" }, ({ key }) => {
          if (key && key !== userId) remoteStore.remove(key);
          realtimeStage("presence-leave");
        });
        realtimeStage("channel-connecting");
        channel.subscribe((status, error) => {
          if (closed) return;
          if (status === "SUBSCRIBED") {
            subscribed = true;
            realtimeStage("subscribed");
            void channel.track({ userId, isOwner: userId === ownerId, joinedAt: Date.now() }).then((result) => {
              if (!closed) realtimeStage(result === "ok" ? "presence-track-ok" : "presence-track-failed", result);
            }).catch((reason: unknown) => { if (!closed) realtimeStage("presence-track-failed", realtimeErrorKind(reason)); });
            if (latestLocal.current) sendRef.current?.(latestLocal.current, true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            subscribed = false;
            remoteStore.clear();
            if (status === "CHANNEL_ERROR") realtimeStage("channel-error", safeRealtimeChannelError(error), inspectRealtimeChannelError(error) ?? undefined);
            else realtimeStage(status === "TIMED_OUT" ? "socket-or-network-failed" : "channel-closed");
            setOwnerOnline(false); setPresentIds([]);
          }
        });
        cleanup = () => { subscribed = false; sendRef.current = null; remoteStore.clear(); realtimeStage("leaving-room"); void channel.untrack().catch(() => {}); void client.removeChannel(channel); };
      } catch (error) {
        if (!closed) {
          realtimeStage(error instanceof RealtimeTokenError ? "token-fetch-failed" : realtimeErrorKind(error), error instanceof RealtimeTokenError ? error.status : undefined);
          setOwnerOnline(false); setPresentIds([]);
          remoteStore.clear();
        }
      }
    }
    void connect();
    const refresh = window.setInterval(() => { void connect(); }, 240_000);
    return () => { closed = true; controller.abort(); window.clearInterval(refresh); sendRef.current = null; remoteStore.clear(); cleanup?.(); };
  }, [session, userId, ownerId, remoteStore]);
  const active = !!(session && userId && ownerId);
  return { ownerOnline: active && ownerOnline, presentIds: active ? presentIds : [], remoteStore, updateLocalMovement };
}
