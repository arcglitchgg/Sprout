import { validateSproutSave } from "@/lib/save-storage";
import type { SproutSaveV3 } from "@/lib/save-types";
import { authenticatedRequest } from "@/lib/session-client";

export type CloudSnapshot = { save: SproutSaveV3 | null; revision: number | null };

export async function fetchCloudSave(session: string): Promise<CloudSnapshot> {
  const response = await authenticatedRequest(session, (activeSession) => fetch("/api/game/save", { headers: { Authorization: `Bearer ${activeSession}` }, cache: "no-store", signal: AbortSignal.timeout(5000) }));
  if (!response.ok) throw new Error("Cloud save load failed.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("save" in data) || !("revision" in data) || !(data.save === null || validateSproutSave(data.save)) || !(data.revision === null || typeof data.revision === "number")) throw new Error("Cloud save response is invalid.");
  return { save: data.save, revision: data.revision };
}

export async function putCloudSave(session: string, save: SproutSaveV3, revision: number | null): Promise<number | "conflict"> {
  const response = await authenticatedRequest(session, (activeSession) => fetch("/api/game/save", { method: "PUT", headers: { Authorization: `Bearer ${activeSession}`, "Content-Type": "application/json" }, body: JSON.stringify({ save, revision }), cache: "no-store", keepalive: true, signal: AbortSignal.timeout(5000) }));
  if (response.status === 409) return "conflict";
  if (!response.ok) throw new Error("Cloud save write failed.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("revision" in data) || typeof data.revision !== "number") throw new Error("Cloud save response is invalid.");
  return data.revision;
}
