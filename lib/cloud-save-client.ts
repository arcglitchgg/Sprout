import { validateSproutSave } from "@/lib/save-storage";
import type { SproutSaveV2 } from "@/lib/save-types";

export type CloudSnapshot = { save: SproutSaveV2 | null; revision: number | null };

export async function fetchCloudSave(session: string): Promise<CloudSnapshot> {
  const response = await fetch("/api/game/save", { headers: { Authorization: `Bearer ${session}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Cloud save load failed.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("save" in data) || !("revision" in data) || !(data.save === null || validateSproutSave(data.save)) || !(data.revision === null || typeof data.revision === "number")) throw new Error("Cloud save response is invalid.");
  return { save: data.save, revision: data.revision };
}

export async function putCloudSave(session: string, save: SproutSaveV2, revision: number | null): Promise<number | "conflict"> {
  const response = await fetch("/api/game/save", { method: "PUT", headers: { Authorization: `Bearer ${session}`, "Content-Type": "application/json" }, body: JSON.stringify({ save, revision }), cache: "no-store", keepalive: true, signal: AbortSignal.timeout(5000) });
  if (response.status === 409) return "conflict";
  if (!response.ok) throw new Error("Cloud save write failed.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("revision" in data) || typeof data.revision !== "number") throw new Error("Cloud save response is invalid.");
  return data.revision;
}
