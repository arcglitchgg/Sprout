import type { CloudSaveErrorKind, CloudSnapshot } from "@/lib/cloud-save-client";
import type { SproutSaveV3 } from "@/lib/save-types";

export const CLOUD_RETRY_DELAYS_MS = [4_000, 5_000, 10_000, 20_000, 30_000] as const;
export function cloudRetryDelay(kind: CloudSaveErrorKind, retryCount: number) {
  if (kind !== "server_unavailable" && kind !== "timeout" && kind !== "network") return null;
  return CLOUD_RETRY_DELAYS_MS[Math.min(Math.max(0, retryCount), CLOUD_RETRY_DELAYS_MS.length - 1)];
}
export function timedOutSaveCommitted(sending: SproutSaveV3, snapshot: CloudSnapshot) {
  return snapshot.revision !== null && snapshot.save !== null && JSON.stringify(sending) === JSON.stringify(snapshot.save);
}
