// Temporary opt-in browser diagnostics. Never include tokens, keys, or payloads.
export function realtimeStage(stage: string, detail?: string | number) {
  if (process.env.NEXT_PUBLIC_REALTIME_DEBUG !== "1") return;
  if (detail === undefined) console.info(`[Sprout Presence] ${stage}`);
  else console.info(`[Sprout Presence] ${stage}: ${detail}`);
}

export function realtimeErrorKind(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/unauthori[sz]ed|invalid.*(jwt|token)|jwt.*(invalid|expired)|signature|token.*expired/i.test(message)) return "token-or-channel-rejected";
  if (/socket|websocket|network|connect|timeout|timed out/i.test(message)) return "socket-or-network-failed";
  return "channel-error";
}
