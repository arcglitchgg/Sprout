import { authenticatedRequest } from "@/lib/session-client";

export async function socialRequest<T>(session: string, path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await authenticatedRequest(session, (activeSession) => fetch(path, {
    method, headers: { Authorization: `Bearer ${activeSession}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  }));
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Neighborhood is unavailable. Please try again.");
  return data as T;
}
