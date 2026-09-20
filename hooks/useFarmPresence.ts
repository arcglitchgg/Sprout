"use client";

import { useEffect, useState } from "react";
import { createRealtimeClient, requestRealtimeToken } from "@/lib/realtime-client";

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
    if (!session || !userId || !ownerId || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    let closed = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    async function connect() {
      cleanup?.();
      cleanup = undefined;
      setOwnerOnline(false);
      setPresentIds([]);
      try {
        const credentials = await requestRealtimeToken(session!, controller.signal);
        if (closed) return;
        const client = createRealtimeClient(credentials.token);
        if (!client) return;
        await client.realtime.setAuth(credentials.token);
        if (closed) return;
        const channel = client.channel(farmRoom(ownerId!), { config: { private: true, presence: { key: userId! } } });
        channel.on("presence", { event: "sync" }, () => {
          if (!closed) {
            const state = channel.presenceState() as Record<string, unknown[]>;
            setOwnerOnline(ownerIsPresent(state, ownerId!));
            setPresentIds(presentUserIds(state));
          }
        });
        channel.subscribe((status) => {
          if (closed) return;
          if (status === "SUBSCRIBED") void channel.track({ userId, isOwner: userId === ownerId, joinedAt: Date.now() });
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { setOwnerOnline(false); setPresentIds([]); }
        });
        cleanup = () => { void channel.untrack(); void client.removeChannel(channel); void client.removeAllChannels(); };
      } catch { if (!closed) setOwnerOnline(false); }
    }
    void connect();
    const refresh = window.setInterval(() => { void connect(); }, 240_000);
    return () => { closed = true; controller.abort(); window.clearInterval(refresh); cleanup?.(); };
  }, [session, userId, ownerId]);
  const active = !!(session && userId && ownerId);
  return { ownerOnline: active && ownerOnline, presentIds: active ? presentIds : [] };
}
