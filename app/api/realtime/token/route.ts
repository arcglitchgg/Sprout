import { sessionUserFromRequest } from "@/lib/discord-session";
import { createRealtimeToken } from "@/lib/realtime-token";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const userId = sessionUserFromRequest(request);
  if (!userId) return Response.json({ error: "Sprout session expired." }, { status: 401, headers });
  try { return Response.json(createRealtimeToken(userId), { headers }); }
  catch { return Response.json({ error: "Realtime is unavailable." }, { status: 503, headers }); }
}
