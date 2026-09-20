// Temporary opt-in browser diagnostics. Never include tokens, keys, or payloads.
export type RealtimeDebugStage = "idle" | "token-request" | "token-received" | "auth-set" | "channel-connecting" | "subscribed" | "presence-track-ok" | "presence-synced" | "channel-error" | "timeout";
export type RealtimeErrorShape = { type: string; constructor: string; keys: string[]; fields: Partial<Record<"message" | "reason" | "code" | "status" | "error" | "type", string>>; cause?: RealtimeErrorShape };
export type RealtimeDebugSnapshot = { stage: RealtimeDebugStage; error: string | null; recent: RealtimeDebugStage[]; channelError: RealtimeErrorShape | null };

let snapshot: RealtimeDebugSnapshot = { stage: "idle", error: null, recent: ["idle"], channelError: null };
const listeners = new Set<() => void>();

export function subscribeRealtimeDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getRealtimeDiagnostics() { return snapshot; }

export function realtimeStage(stage: string, detail?: string | number, channelError?: RealtimeErrorShape) {
  if (process.env.NEXT_PUBLIC_REALTIME_DEBUG !== "1") return;
  if (detail === undefined) console.info(`[Sprout Presence] ${stage}`);
  else console.info(`[Sprout Presence] ${stage}: ${detail}`);

  let next: RealtimeDebugStage | null = null;
  let error: string | null = null;
  if (stage === "token-fetch-start") next = "token-request";
  else if (stage === "token-received" || stage === "auth-set" || stage === "channel-connecting" || stage === "subscribed" || stage === "presence-track-ok" || stage === "presence-synced") next = stage;
  else if (stage === "leaving-room" || stage === "channel-closed") next = "idle";
  else if (stage === "socket-or-network-failed") { next = "timeout"; error = "Socket or network timed out."; }
  else if (stage === "token-fetch-failed") { next = "channel-error"; error = typeof detail === "number" && detail >= 400 && detail < 600 ? `Token endpoint returned HTTP ${detail}.` : "Token request failed."; }
  else if (stage === "browser-config-missing") { next = "channel-error"; error = "Browser Realtime configuration is missing."; }
  else if (stage === "session-unavailable") { next = "idle"; error = "No Sprout session is available."; }
  else if (stage === "presence-track-failed") { next = detail === "timed out" ? "timeout" : "channel-error"; error = detail === "timed out" ? "Presence tracking timed out." : "Presence tracking failed."; }
  else if (stage === "token-or-channel-rejected") { next = "channel-error"; error = "Token or room access was rejected."; }
  else if (stage === "channel-error") { next = "channel-error"; error = typeof detail === "string" ? detail : "Realtime channel failed."; }
  if (!next) return;
  snapshot = { stage: next, error, recent: [...snapshot.recent, next].slice(-8), channelError: next === "channel-error" ? channelError ?? null : null };
  listeners.forEach((listener) => listener());
}

export function realtimeErrorKind(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/unauthori[sz]ed|invalid.*(jwt|token)|jwt.*(invalid|expired)|signature|token.*expired/i.test(message)) return "token-or-channel-rejected";
  if (/socket|websocket|network|connect|timeout|timed out/i.test(message)) return "socket-or-network-failed";
  return "channel-error";
}

// Only return known Realtime error categories; never display server text that may
// contain a token, request header, key, or other unexpected value.
export function safeRealtimeChannelError(error: unknown) {
  if (error == null) return "CHANNEL_ERROR callback contained no reason payload";
  const message = error instanceof Error ? error.message : "";
  if (/invalid.?jwt|invalid.*token|jwt.*(invalid|expired)|signature|token.*expired/i.test(message)) return "Supabase rejected the JWT (InvalidJWT).";
  if (/privateonly|private.only/i.test(message)) return "Supabase requires a private channel (PrivateOnly).";
  if (/unabletosetpolicies/i.test(message)) return "Supabase could not evaluate the channel policies (UnableToSetPolicies).";
  if (/rls|row.level.security|policy|permission denied/i.test(message)) return "Supabase denied the channel policy.";
  if (/unauthori[sz]ed/i.test(message)) return "Supabase denied channel access (Unauthorized).";
  if (/realtimedisabledfortenant|realtime was disabled/i.test(message)) return "Supabase Realtime is disabled for this project.";
  if (/timeout|timed out/i.test(message)) return "Supabase channel subscription timed out.";
  return "Realtime channel failed (unrecognized server reason).";
}

const safeFields = ["message", "reason", "code", "status", "error", "type"] as const;

function safeDiagnosticValue(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return null;
  if (/bearer\s|authorization|sb_(?:publishable|secret)_|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:token|secret|api[_-]?key|private[_-]?key|signing[_-]?jwk)\s*[:=]|[{}]/i.test(value)) return "[redacted sensitive value]";
  return value.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]").replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 180);
}

function inspectShape(value: unknown, inspectCause: boolean): RealtimeErrorShape {
  const type = typeof value;
  if (value === null || (type !== "object" && type !== "function")) {
    return { type: value === null ? "null" : type, constructor: "none", keys: [], fields: safeDiagnosticValue(value) === null ? {} : { message: safeDiagnosticValue(value)! } };
  }
  const object = value as object;
  const keys = Object.keys(object).slice(0, 20).map((key) => safeDiagnosticValue(key) ?? "[unknown]");
  const constructor = safeDiagnosticValue(Object.getPrototypeOf(object)?.constructor?.name) ?? "unknown";
  const fields: RealtimeErrorShape["fields"] = {};
  for (const field of safeFields) {
    const descriptor = Object.getOwnPropertyDescriptor(object, field);
    if (!descriptor || !("value" in descriptor)) continue;
    const safe = safeDiagnosticValue(descriptor.value);
    if (safe !== null) fields[field] = safe;
    else if (descriptor.value !== undefined) fields[field] = `[${typeof descriptor.value}; not displayed]`;
  }
  const cause = inspectCause ? Object.getOwnPropertyDescriptor(object, "cause") : undefined;
  return { type, constructor, keys, fields, ...(cause && "value" in cause && cause.value !== undefined ? { cause: inspectShape(cause.value, false) } : {}) };
}

export function inspectRealtimeChannelError(value: unknown): RealtimeErrorShape | null {
  return value == null ? null : inspectShape(value, true);
}
