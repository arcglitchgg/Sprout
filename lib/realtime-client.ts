import { createClient } from "@supabase/supabase-js";

export class RealtimeTokenError extends Error {
  constructor(readonly status: number) { super("Realtime token request failed."); }
}

export function createRealtimeClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, realtime: { params: { eventsPerSecond: 1 } } });
}

export async function requestRealtimeToken(session: string, signal?: AbortSignal): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch("/api/realtime/token", { method: "POST", headers: { Authorization: `Bearer ${session}` }, cache: "no-store", signal });
  if (!response.ok) throw new RealtimeTokenError(response.status);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("token" in data) || typeof data.token !== "string" || !("expiresAt" in data) || typeof data.expiresAt !== "number") throw new Error("Invalid Realtime token response.");
  return { token: data.token, expiresAt: data.expiresAt };
}
