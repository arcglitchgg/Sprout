"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRealtimeClient, RealtimeTokenError, requestRealtimeToken } from "@/lib/realtime-client";
import { inspectRealtimeChannelError, realtimeErrorKind, realtimeStage, realtimeTransportEvent, safeRealtimeChannelError, safeRealtimeCloseReason, safeRealtimeHostname } from "@/lib/realtime-diagnostics";
import { shouldSendMovement, createRemoteMovementStore, type RemoteMovementPacket } from "@/lib/remote-movement";
import { CHALLENGE_MS, validChallengePacket, type ChallengeEvent, type ChallengePacket, type ChallengeState } from "@/lib/challenges";
import { socialRequest } from "@/lib/social-client";
import type { LivePvpMatch } from "@/lib/pvp-types";
import { reconcilePresence } from "@/lib/presence-grace";

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
  const [reconnectingIds, setReconnectingIds] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);
  const challengeRef = useRef<ChallengeState | null>(null);
  const challengeSend = useRef<((event: ChallengeEvent, packet: ChallengePacket) => Promise<boolean>) | null>(null);
  const membersRef = useRef<Set<string>>(new Set());
  const observedRef = useRef<Set<string>>(new Set());
  const graceRef = useRef(new Map<string, number>());
  const presentKeyRef = useRef("");
  const reconnectingKeyRef = useRef("");
  const changeChallenge = useCallback((next: ChallengeState | null) => { challengeRef.current = next; setChallenge(next); }, []);
  const requestChallenge = useCallback(async (targetId: string) => {
    if (!userId || targetId === userId || challengeRef.current || !observedRef.current.has(targetId) || !challengeSend.current) return false;
    const createdAt = Date.now();
    const packet = { challengeId: crypto.randomUUID(), fromUserId: userId, toUserId: targetId, createdAt, expiresAt: createdAt + CHALLENGE_MS };
    try { await socialRequest(session!, "/api/pvp/matches", "POST", { challengeId: packet.challengeId, opponentId: targetId, farmOwnerId: ownerId }); }
    catch { setChallengeMessage("Challenge could not be created."); return false; }
    if (challengeRef.current || !membersRef.current.has(targetId)) { void socialRequest(session!, `/api/pvp/matches/${packet.challengeId}`, "DELETE").catch(() => {}); return false; }
    changeChallenge({ role: "outgoing", status: "pending", packet });
    setChallengeMessage(null);
    if (await challengeSend.current?.("challenge-request", packet)) return true;
    void socialRequest(session!, `/api/pvp/matches/${packet.challengeId}`, "DELETE").catch(() => {});
    const pending = challengeRef.current as ChallengeState | null;
    if (pending?.packet.challengeId === packet.challengeId) changeChallenge(null);
    setChallengeMessage("Challenge could not be sent.");
    return false;
  }, [session, userId, ownerId, changeChallenge]);
  const respondChallenge = useCallback(async (accept: boolean) => {
    const active = challengeRef.current;
    if (!active || active.role !== "incoming" || active.status !== "pending" || !challengeSend.current) return;
    try {
      if (accept) await socialRequest(session!, `/api/pvp/matches/${active.packet.challengeId}`, "POST");
      else await socialRequest(session!, `/api/pvp/matches/${active.packet.challengeId}`, "DELETE");
    } catch { setChallengeMessage("Could not confirm the challenge."); return; }
    if (challengeRef.current?.packet.challengeId !== active.packet.challengeId) {
      if (accept) void socialRequest(session!, `/api/pvp/matches/${active.packet.challengeId}`, "DELETE").catch(() => {});
      return;
    }
    await challengeSend.current?.(accept ? "challenge-accept" : "challenge-decline", active.packet);
    changeChallenge(accept ? { ...active, status: "accepted" } : null);
    setChallengeMessage(accept ? "Challenge accepted — Battle coming next" : null);
  }, [session, changeChallenge]);
  const dismissChallenge = useCallback(() => {
    const active = challengeRef.current;
    if (active?.role === "outgoing" && active.status === "pending") {
      void challengeSend.current?.("challenge-cancel", active.packet);
      if (session) void socialRequest(session, `/api/pvp/matches/${active.packet.challengeId}`, "DELETE").catch(() => {});
    }
    changeChallenge(null); setChallengeMessage(null);
  }, [session, changeChallenge]);
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
    let reconnectTimer: number | undefined;
    const controller = new AbortController();
    const graceDeadlines = graceRef.current;
    const reconcile = (observed: ReadonlySet<string>) => {
      observedRef.current = new Set(observed);
      const { effective, expired } = reconcilePresence(membersRef.current, observed, graceDeadlines, Date.now());
      membersRef.current = effective;
      const ids = [...effective].sort();
      const presentKey = ids.join(",");
      if (presentKey !== presentKeyRef.current) { presentKeyRef.current = presentKey; setPresentIds(ids); }
      const reconnecting = [...graceDeadlines.keys()].filter((id) => id !== userId).sort();
      const reconnectingKey = reconnecting.join(",");
      if (reconnectingKey !== reconnectingKeyRef.current) {
        reconnectingKeyRef.current = reconnectingKey;
        setReconnectingIds(reconnecting);
      }
      setOwnerOnline(effective.has(ownerId!));
      remoteStore.retain(effective);
      const active = challengeRef.current;
      if (active?.status === "pending" && expired.includes(active.role === "outgoing" ? active.packet.toUserId : active.packet.fromUserId)) {
        void socialRequest(session!, `/api/pvp/matches/${active.packet.challengeId}`, "DELETE").catch(() => {});
        changeChallenge(null); setChallengeMessage("Player left the farm.");
      }
    };
    async function connect() {
      cleanup?.();
      cleanup = undefined;
      reconcile(new Set());
      sendRef.current = null;
      challengeSend.current = null;
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
        let retired = false;
        let subscribed = false;
        let lastSent: RemoteMovementPacket | null = null;
        let lastSentAt = 0;
        let sequence = 0;
        let incomingPending = false;
        challengeSend.current = async (event, packet) => {
          if (!subscribed || closed) return false;
          try { return await channel.send({ type: "broadcast", event, payload: packet }) === "ok"; }
          catch { return false; }
        };
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
          if (!closed && !retired) remoteStore.apply(payload, observedRef.current, userId!, Date.now());
        });
        for (const event of ["challenge-request", "challenge-accept", "challenge-decline", "challenge-cancel", "challenge-busy"] as ChallengeEvent[]) {
          channel.on("broadcast", { event }, async ({ payload }) => {
            if (closed || retired || !validChallengePacket(payload, observedRef.current, Date.now())) return;
            const packet = payload as ChallengePacket;
            if (event === "challenge-request") {
              if (packet.toUserId !== userId) return;
              if (challengeRef.current || incomingPending) { void challengeSend.current?.("challenge-busy", packet); return; }
              incomingPending = true;
              try {
                const match = await socialRequest<LivePvpMatch>(session!, `/api/pvp/matches/${packet.challengeId}`);
                if (closed || match.status !== "pending_acceptance" || match.challengerId !== packet.fromUserId || match.opponentId !== userId || challengeRef.current) return;
              } catch { return; }
              finally { incomingPending = false; }
              changeChallenge({ role: "incoming", status: "pending", packet });
              setChallengeMessage(null);
              return;
            }
            const active = challengeRef.current;
            if (!active || active.packet.challengeId !== packet.challengeId || active.packet.fromUserId !== packet.fromUserId || active.packet.toUserId !== packet.toUserId) return;
            if (active.role === "outgoing" && packet.fromUserId === userId) {
              if (event === "challenge-accept") {
                try {
                  const match = await socialRequest<LivePvpMatch>(session!, `/api/pvp/matches/${packet.challengeId}`);
                  if (closed || challengeRef.current?.packet.challengeId !== packet.challengeId || match.status !== "waiting_for_teams" || match.challengerId !== userId || match.opponentId !== packet.toUserId) return;
                  changeChallenge({ ...active, status: "accepted" }); setChallengeMessage("Challenge accepted — Battle coming next");
                } catch { /* Polling can recover an accepted match. */ }
              }
              if (event === "challenge-decline" || event === "challenge-busy") { changeChallenge(null); setChallengeMessage(event === "challenge-busy" ? "Player is busy" : "Challenge declined"); }
            } else if (active.role === "incoming" && event === "challenge-cancel") { changeChallenge(null); setChallengeMessage("Challenge cancelled"); }
          });
        }
        channel.on("presence", { event: "sync" }, () => {
          if (!closed && !retired) {
            const state = channel.presenceState() as Record<string, unknown[]>;
            const ids = presentUserIds(state);
            const joined = ids.some((id) => id !== userId && !membersRef.current.has(id));
            reconcile(new Set(ids));
            if (joined && latestLocal.current) sendRef.current?.(latestLocal.current, true);
            realtimeStage("presence-synced", ids.length);
          }
        });
        channel.on("presence", { event: "join" }, () => {
          realtimeStage("presence-join");
        });
        channel.on("presence", { event: "leave" }, () => {
          realtimeStage("presence-leave");
        });
        realtimeStage("channel-connecting");
        channel.subscribe((status, error) => {
          if (closed || retired) return;
          if (status === "SUBSCRIBED") {
            subscribed = true;
            realtimeStage("subscribed");
            void channel.track({ userId, isOwner: userId === ownerId, joinedAt: Date.now() }).then((result) => {
              if (!closed) realtimeStage(result === "ok" ? "presence-track-ok" : "presence-track-failed", result);
            }).catch((reason: unknown) => { if (!closed) realtimeStage("presence-track-failed", realtimeErrorKind(reason)); });
            if (latestLocal.current) sendRef.current?.(latestLocal.current, true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            subscribed = false;
            challengeSend.current = null;
            reconcile(new Set());
            if (status === "CHANNEL_ERROR") realtimeStage("channel-error", safeRealtimeChannelError(error), inspectRealtimeChannelError(error) ?? undefined);
            else realtimeStage(status === "TIMED_OUT" ? "socket-or-network-failed" : "channel-closed");
            if (reconnectTimer === undefined) reconnectTimer = window.setTimeout(() => { reconnectTimer = undefined; void connect(); }, 1500);
          }
        });
        cleanup = () => { retired = true; subscribed = false; sendRef.current = null; challengeSend.current = null; realtimeStage("leaving-room"); void channel.untrack().catch(() => {}); void client.removeChannel(channel); };
      } catch (error) {
        if (!closed) {
          realtimeStage(error instanceof RealtimeTokenError ? "token-fetch-failed" : realtimeErrorKind(error), error instanceof RealtimeTokenError ? error.status : undefined);
          reconcile(new Set());
          if (reconnectTimer === undefined) reconnectTimer = window.setTimeout(() => { reconnectTimer = undefined; void connect(); }, 1500);
        }
      }
    }
    void connect();
    const refresh = window.setInterval(() => { void connect(); }, 240_000);
    const timeout = window.setInterval(() => {
      if (graceDeadlines.size) reconcile(observedRef.current);
      const active = challengeRef.current;
      if (active?.status === "pending" && Date.now() >= active.packet.expiresAt) { changeChallenge(null); setChallengeMessage(active.role === "outgoing" ? "Challenge expired" : null); }
    }, 250);
    const poll = window.setInterval(() => {
      const active = challengeRef.current;
      if (active?.role !== "outgoing" || active.status !== "pending") return;
      void socialRequest<LivePvpMatch>(session!, `/api/pvp/matches/${active.packet.challengeId}`).then((match) => {
        if (closed || challengeRef.current?.packet.challengeId !== match.id) return;
        if (match.status === "waiting_for_teams" || match.status === "ready") { changeChallenge({ ...active, status: "accepted" }); setChallengeMessage("Challenge accepted — Battle coming next"); }
        if (match.status === "cancelled" || match.status === "expired") { changeChallenge(null); setChallengeMessage(match.status === "expired" ? "Challenge expired" : "Challenge declined"); }
      }).catch(() => {});
    }, 1000);
    return () => { closed = true; controller.abort(); window.clearInterval(refresh); window.clearInterval(timeout); window.clearInterval(poll); if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer); graceDeadlines.clear(); observedRef.current.clear(); presentKeyRef.current = ""; reconnectingKeyRef.current = ""; sendRef.current = null; challengeSend.current = null; membersRef.current = new Set(); remoteStore.clear(); cleanup?.(); };
  }, [session, userId, ownerId, remoteStore, changeChallenge]);
  const active = !!(session && userId && ownerId);
  return { ownerOnline: active && ownerOnline, presentIds: active ? presentIds : [], reconnectingIds: active ? reconnectingIds : [], remoteStore, updateLocalMovement, challenge, challengeMessage, requestChallenge, respondChallenge, dismissChallenge };
}
