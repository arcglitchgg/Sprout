import { NextResponse } from "next/server";
import { sessionUserFromRequest } from "@/lib/discord-session";
import { readCloudSave, writeCloudSave } from "@/lib/supabase-admin";
import { migrateSproutSave, validateSproutSave } from "@/lib/save-storage";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 1024 * 1024;
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const userId = sessionUserFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  try {
    const row = await readCloudSave(userId);
    const save = row ? migrateSproutSave(row.save) : null;
    if (row && !save) return NextResponse.json({ error: "Stored save is invalid." }, { status: 500, headers });
    return NextResponse.json({ save, revision: row?.revision ?? null, updatedAt: row?.updatedAt ?? null }, { headers });
  } catch {
    return NextResponse.json({ error: "Cloud save unavailable." }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const userId = sessionUserFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return NextResponse.json({ error: "Save too large." }, { status: 413, headers });
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return NextResponse.json({ error: "Save too large." }, { status: 413, headers });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || !("save" in body) || !("revision" in body) || !validateSproutSave(body.save) || !Number.isSafeInteger(body.save.game.coins) || !Number.isSafeInteger(body.save.game.farmXp) || !(body.revision === null || (Number.isSafeInteger(body.revision) && typeof body.revision === "number" && body.revision > 0))) {
    return NextResponse.json({ error: "Invalid Save V3 or revision." }, { status: 400, headers });
  }
  try {
    const result = await writeCloudSave(userId, body.save, body.revision);
    if (result === "conflict") return NextResponse.json({ error: "Save revision conflict." }, { status: 409, headers });
    return NextResponse.json(result, { headers });
  } catch { return NextResponse.json({ error: "Cloud save unavailable." }, { status: 503, headers }); }
}
