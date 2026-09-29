"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { authenticateDiscordActivity, isDiscordActivity, renewDiscordActivitySession } from "@/lib/discord-client";
import type { BasicDiscordUser, DiscordEnvironment } from "@/lib/discord-client";
import { configureSessionController, type SessionDisconnectReason } from "@/lib/session-client";

export type DiscordRuntimeState = {
  environment: DiscordEnvironment;
  ready: boolean;
  user: BasicDiscordUser | null;
  error: string | null;
  session: string | null;
  resolved: boolean;
  sessionDisconnected: boolean;
};

const standaloneState: DiscordRuntimeState = { environment: "standalone", ready: false, user: null, error: null, session: null, resolved: false, sessionDisconnected: false };
export const DiscordContext = createContext<DiscordRuntimeState>(standaloneState);
let supabaseMappingPatched = false;

async function exchangeAuthorizationCode(code: string) {
  const response = await fetch("/api/discord/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof data !== "object" || data === null || !("access_token" in data) || typeof data.access_token !== "string") {
    throw new Error("Discord authorization code exchange failed.");
  }
  return { accessToken: data.access_token, session: "session" in data && typeof data.session === "string" ? data.session : null };
}

export default function DiscordProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DiscordRuntimeState>(standaloneState);

  useEffect(() => {
    if (!isDiscordActivity(window.location.search)) {
      queueMicrotask(() => setState({ ...standaloneState, resolved: true }));
      return;
    }
    let cancelled = false;
    let releaseSessionController: (() => void) | undefined;
    const initialize = async () => {
      await Promise.resolve();
      if (!cancelled) setState({ environment: "discord", ready: false, user: null, error: null, session: null, resolved: false, sessionDisconnected: false });
      const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
      if (!clientId) {
        if (!cancelled) setState({ environment: "discord", ready: false, user: null, error: "NEXT_PUBLIC_DISCORD_CLIENT_ID is not configured.", session: null, resolved: true, sessionDisconnected: false });
        return;
      }
      try {
        if (!supabaseMappingPatched) {
          patchUrlMappings([{ prefix: "/supabase", target: "uchattvjtpzzyoluekcp.supabase.co" }], { patchWebSocket: true });
          supabaseMappingPatched = true;
        }
        const sdk = new DiscordSDK(clientId);
        let session: string | null = null;
        const user = await authenticateDiscordActivity({
          clientId,
          sdk,
          exchangeCode: async (code) => { const result = await exchangeAuthorizationCode(code); session = result.session; return result; },
          onReady: () => {
            if (!cancelled) setState({ environment: "discord", ready: true, user: null, error: null, session: null, resolved: false, sessionDisconnected: false });
          },
        });
        if (!session) throw new Error("Sprout session was not issued.");
        releaseSessionController = configureSessionController({
          session,
          renew: () => renewDiscordActivitySession({ clientId, sdk, exchangeCode: exchangeAuthorizationCode, expectedUserId: user.id }),
          onRenewed: (renewedSession) => {
            if (!cancelled) setState((current) => ({ ...current, session: renewedSession, sessionDisconnected: false }));
          },
          onDisconnected: (reason: SessionDisconnectReason) => {
            if (!cancelled) setState((current) => ({ ...current, session: null, sessionDisconnected: true, error: reason }));
          },
        });
        if (!cancelled) setState({ environment: "discord", ready: true, user, error: null, session, resolved: true, sessionDisconnected: false });
      } catch (error) {
        if (!cancelled) setState((current) => ({ environment: "discord", ready: current.ready, user: null, error: error instanceof Error ? error.message : "Discord initialization failed.", session: null, resolved: true, sessionDisconnected: false }));
      }
    };
    void initialize();
    return () => { cancelled = true; releaseSessionController?.(); };
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <DiscordContext.Provider value={value}>
      {children}
      {state.sessionDisconnected && <SessionDisconnectedModal />}
      {process.env.NODE_ENV === "development" && <DiscordDevelopmentIndicator state={state} />}
    </DiscordContext.Provider>
  );
}

function SessionDisconnectedModal() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4" role="alertdialog" aria-modal="true" aria-labelledby="session-disconnected-title">
      <section className="max-w-md rounded-xl border-4 border-[#70452d] bg-[#fff0c2] p-6 text-center text-[#4a2c12] shadow-2xl">
        <h2 id="session-disconnected-title" className="text-xl font-black">Session Disconnected</h2>
        <p className="mt-3 font-semibold">Your Sprout session has expired. Reopen the Discord Activity to reconnect and continue playing.</p>
        <p className="mt-2 text-sm">Your locally saved progress is still preserved.</p>
      </section>
    </div>
  );
}

function DiscordDevelopmentIndicator({ state }: { state: DiscordRuntimeState }) {
  return (
    <aside className="fixed bottom-2 right-2 z-[100] max-w-72 rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs text-white shadow-lg">
      <div>Environment: {state.environment === "discord" ? "Discord" : "Standalone"}</div>
      <div>SDK ready: {state.ready ? "Yes" : "No"}</div>
      {state.user && <><div>User: {state.user.globalName ?? state.user.username}</div><div>ID: {state.user.id}</div></>}
      {state.error && <div className="text-red-300">{state.error}</div>}
    </aside>
  );
}
