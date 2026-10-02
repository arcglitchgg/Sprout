import type { SproutSaveV3 } from "@/lib/save-types";

export type CloudRevisionState =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "known"; revision: number };

export type SaveAcknowledgement = { revision: number; savedAt: number };
export type StartupDecision = "cloud" | "local-upload" | "local-conflict" | "empty";

export const UNKNOWN_CLOUD_REVISION: CloudRevisionState = { kind: "unknown" };

export function revisionFromSnapshot(revision: number | null): CloudRevisionState {
  return revision === null ? { kind: "none" } : { kind: "known", revision };
}

export function revisionForWrite(state: CloudRevisionState): number | null | undefined {
  return state.kind === "unknown" ? undefined : state.kind === "none" ? null : state.revision;
}

export function isSaveAcknowledged(local: SproutSaveV3, cloud: SproutSaveV3 | null, acknowledgement: SaveAcknowledgement | null) {
  if (acknowledgement && acknowledgement.savedAt >= local.savedAt) return true;
  return cloud !== null && JSON.stringify(local) === JSON.stringify(cloud);
}

export function chooseStartupSave(local: SproutSaveV3 | null, cloud: SproutSaveV3 | null, acknowledgement: SaveAcknowledgement | null): StartupDecision {
  if (!local && !cloud) return "empty";
  if (local && !cloud) return "local-upload";
  if (!local) return "cloud";
  if (!cloud) return "local-upload";
  if (local.savedAt > cloud.savedAt) return "local-upload";
  return isSaveAcknowledged(local, cloud, acknowledgement) ? "cloud" : "local-conflict";
}

export function canRetryLocalAfterConflict(local: SproutSaveV3, cloud: SproutSaveV3 | null) {
  return cloud === null || local.savedAt > cloud.savedAt;
}
