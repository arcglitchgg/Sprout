import type { CloudRevisionState } from "@/lib/save-reconciliation";
import type { CloudSaveErrorKind } from "@/lib/cloud-save-client";

export type CloudSaveDiagnostic = {
  attemptId: number; payloadBytes: number; revisionState: CloudRevisionState["kind"]; revision: number | null;
  httpStatus?: number; errorType?: CloudSaveErrorKind; durationMs: number; retryCount: number; backoffMs?: number;
  reconciliation?: "committed" | "still-dirty" | "conflict" | "failed";
};
export function logCloudSaveDiagnostic(event: "start" | "result", diagnostic: CloudSaveDiagnostic) {
  if (process.env.NODE_ENV === "production") return;
  const safe = {
    attemptId: diagnostic.attemptId,
    payloadBytes: diagnostic.payloadBytes,
    revisionState: diagnostic.revisionState,
    revision: diagnostic.revision,
    durationMs: diagnostic.durationMs,
    retryCount: diagnostic.retryCount,
    ...(diagnostic.httpStatus === undefined ? {} : { httpStatus: diagnostic.httpStatus }),
    ...(diagnostic.errorType === undefined ? {} : { errorType: diagnostic.errorType }),
    ...(diagnostic.backoffMs === undefined ? {} : { backoffMs: diagnostic.backoffMs }),
    ...(diagnostic.reconciliation === undefined ? {} : { reconciliation: diagnostic.reconciliation }),
  };
  console.info(`[Sprout cloud save] ${event}`, safe);
}
