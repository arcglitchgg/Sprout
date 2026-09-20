"use client";

import { useEffect, useState } from "react";
import { createRealtimeClient, RealtimeTokenError, requestRealtimeToken } from "@/lib/realtime-client";
import { inspectRealtimeChannelError, realtimeErrorKind, realtimeStage, realtimeTransportEvent, safeRealtimeChannelError, safeRealtimeCloseReason, safeRealtimeHostname } from "@/lib/realtime-diagnostics";

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
  useEffect(() => {
    if (!session || !userId || !ownerId) { realtimeStage("session-unavailable"); return; }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) { realtimeStage("browser-config-missing"); return; }
    let closed = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    async function connect() {
      cleanup?.();
      cleanup = undefined;
      setOwnerOnline(false);
      setPresentIds([]);
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
        channel.on("presence", { event: "sync" }, () => {
          if (!closed) {
            const state = channel.presenceState() as Record<string, unknown[]>;
            setOwnerOnline(ownerIsPresent(state, ownerId!));
            const ids = presentUserIds(state);
            setPresentIds(ids);
            realtimeStage("presence-synced", ids.length);
          }
        });
        channel.on("presence", { event: "join" }, () => realtimeStage("presence-join"));
        channel.on("presence", { event: "leave" }, () => realtimeStage("presence-leave"));
        realtimeStage("channel-connecting");
        channel.subscribe((status, error) => {
          if (closed) return;
          if (status === "SUBSCRIBED") {
            realtimeStage("subscribed");
            void channel.track({ userId, isOwner: userId === ownerId, joinedAt: Date.now() }).then((result) => {
              if (!closed) realtimeStage(result === "ok" ? "presence-track-ok" : "presence-track-failed", result);
            }).catch((reason: unknown) => { if (!closed) realtimeStage("presence-track-failed", realtimeErrorKind(reason)); });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (status === "CHANNEL_ERROR") realtimeStage("channel-error", safeRealtimeChannelError(error), inspectRealtimeChannelError(error) ?? undefined);
            else realtimeStage(status === "TIMED_OUT" ? "socket-or-network-failed" : "channel-closed");
            setOwnerOnline(false); setPresentIds([]);
          }
        });
        cleanup = () => { realtimeStage("leaving-room"); void channel.untrack().catch(() => {}); void client.removeChannel(channel); };
      } catch (error) {
        if (!closed) {
          realtimeStage(error instanceof RealtimeTokenError ? "token-fetch-failed" : realtimeErrorKind(error), error instanceof RealtimeTokenError ? error.status : undefined);
          setOwnerOnline(false); setPresentIds([]);
        }
      }
    }
    void connect();
    const refresh = window.setInterval(() => { void connect(); }, 240_000);
    return () => { closed = true; controller.abort(); window.clearInterval(refresh); cleanup?.(); };
  }, [session, userId, ownerId]);
  const active = !!(session && userId && ownerId);
  return { ownerOnline: active && ownerOnline, presentIds: active ? presentIds : [] };
}
