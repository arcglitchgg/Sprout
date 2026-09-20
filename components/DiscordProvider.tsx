"use client";

import { createContext, useEffect, useMemo, useState } from "react";
import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { authenticateDiscordActivity, isDiscordActivity } from "@/lib/discord-client";
import type { BasicDiscordUser, DiscordEnvironment } from "@/lib/discord-client";

export type DiscordRuntimeState = {
  environment: DiscordEnvironment;
  ready: boolean;
  user: BasicDiscordUser | null;
  error: string | null;
  session: string | null;
  resolved: boolean;
};

const standaloneState: DiscordRuntimeState = { environment: "standalone", ready: false, user: null, error: null, session: null, resolved: false };
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
    const initialize = async () => {
      await Promise.resolve();
        if (!cancelled) setState({ environment: "discord", ready: false, user: null, error: null, session: null, resolved: false });
      const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
      if (!clientId) {
        if (!cancelled) setState({ environment: "discord", ready: false, user: null, error: "NEXT_PUBLIC_DISCORD_CLIENT_ID is not configured.", session: null, resolved: true });
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
            if (!cancelled) setState({ environment: "discord", ready: true, user: null, error: null, session: null, resolved: false });
          },
        });
        if (!cancelled) setState({ environment: "discord", ready: true, user, error: null, session, resolved: true });
      } catch (error) {
        if (!cancelled) setState((current) => ({ environment: "discord", ready: current.ready, user: null, error: error instanceof Error ? error.message : "Discord initialization failed.", session: null, resolved: true }));
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <DiscordContext.Provider value={value}>
      {children}
      {process.env.NODE_ENV === "development" && <DiscordDevelopmentIndicator state={state} />}
    </DiscordContext.Provider>
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
