import { migrateSproutSave } from "@/lib/save-storage";
import type { SproutSaveV3 } from "@/lib/save-types";
import { authenticatedRequest, SessionDisconnectedError } from "@/lib/session-client";

export type CloudSnapshot = { save: SproutSaveV3 | null; revision: number | null };
export type CloudSaveErrorKind = "unauthorized" | "validation" | "conflict" | "payload_too_large" | "server_unavailable" | "timeout" | "network" | "invalid_response" | "unknown";

export class CloudSaveError extends Error {
  constructor(public readonly kind: CloudSaveErrorKind, public readonly status?: number) {
    super(`Cloud save request failed: ${kind}.`);
    this.name = "CloudSaveError";
  }
}

const kindForStatus = (status: number): CloudSaveErrorKind => status === 401 ? "unauthorized" : status === 400 ? "validation" : status === 409 ? "conflict" : status === 413 ? "payload_too_large" : status === 503 ? "server_unavailable" : "unknown";
function classifyThrown(error: unknown): CloudSaveError {
  if (error instanceof CloudSaveError) return error;
  if (error instanceof SessionDisconnectedError) throw error;
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return new CloudSaveError("timeout");
  if (error instanceof TypeError) return new CloudSaveError("network");
  if (error instanceof Error) return new CloudSaveError("network");
  return new CloudSaveError("unknown");
}
async function parseJson(response: Response) {
  try { return await response.json() as unknown; }
  catch { throw new CloudSaveError("invalid_response", response.status); }
}
export function cloudSavePayloadBytes(save: SproutSaveV3, revision: number | null) {
  return new TextEncoder().encode(JSON.stringify({ save, revision })).length;
}

export async function fetchCloudSave(session: string): Promise<CloudSnapshot> {
  try {
    const response = await authenticatedRequest(session, (activeSession) => fetch("/api/game/save", { headers: { Authorization: `Bearer ${activeSession}` }, cache: "no-store", signal: AbortSignal.timeout(5000) }));
    if (!response.ok) throw new CloudSaveError(kindForStatus(response.status), response.status);
    const data = await parseJson(response);
    if (!data || typeof data !== "object" || !("save" in data) || !("revision" in data) || !(data.revision === null || typeof data.revision === "number")) throw new CloudSaveError("invalid_response", response.status);
    const save = data.save === null ? null : migrateSproutSave(data.save);
    if (data.save !== null && !save) throw new CloudSaveError("invalid_response", response.status);
    return { save, revision: data.revision };
  } catch (error) { throw classifyThrown(error); }
}

export async function putCloudSave(session: string, save: SproutSaveV3, revision: number | null): Promise<number | "conflict"> {
  try {
    const response = await authenticatedRequest(session, (activeSession) => fetch("/api/game/save", { method: "PUT", headers: { Authorization: `Bearer ${activeSession}`, "Content-Type": "application/json" }, body: JSON.stringify({ save, revision }), cache: "no-store", signal: AbortSignal.timeout(5000) }));
    if (response.status === 409) return "conflict";
    if (!response.ok) throw new CloudSaveError(kindForStatus(response.status), response.status);
    const data = await parseJson(response);
    if (!data || typeof data !== "object" || !("revision" in data) || typeof data.revision !== "number") throw new CloudSaveError("invalid_response", response.status);
    return data.revision;
  } catch (error) { throw classifyThrown(error); }
}
