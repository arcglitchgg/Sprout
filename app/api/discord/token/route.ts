import { NextResponse } from "next/server";
import { createSproutSession } from "@/lib/discord-session";
import { upsertPlayerProfile } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  }
  const code = typeof body === "object" && body !== null && "code" in body ? body.code : null;
  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "A Discord authorization code is required." }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Discord OAuth is not configured." }, { status: 500 });
  }

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code }),
      cache: "no-store",
    });
    const token: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof token !== "object" || token === null || !("access_token" in token) || typeof token.access_token !== "string") {
      return NextResponse.json({ error: "Discord rejected the authorization code." }, { status: 502 });
    }
    const identityResponse = await fetch("https://discord.com/api/v10/oauth2/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store",
    });
    const identity: unknown = await identityResponse.json().catch(() => null);
    if (!identityResponse.ok || !identity || typeof identity !== "object" || !("application" in identity) || !("user" in identity) || !("scopes" in identity)) {
      return NextResponse.json({ error: "Discord identity verification failed." }, { status: 502 });
    }
    const app = identity.application;
    const user = identity.user;
    if (!app || typeof app !== "object" || !("id" in app) || app.id !== clientId || !Array.isArray(identity.scopes) || !identity.scopes.includes("identify") || !user || typeof user !== "object" || !("id" in user) || !("username" in user) || typeof user.id !== "string" || typeof user.username !== "string") {
      return NextResponse.json({ error: "Discord identity verification failed." }, { status: 502 });
    }
    let session: string | null = null;
    try {
      session = createSproutSession(user.id);
      await upsertPlayerProfile({ id: user.id, username: user.username, displayName: "global_name" in user && typeof user.global_name === "string" ? user.global_name : null, avatar: "avatar" in user && typeof user.avatar === "string" ? user.avatar : null });
    } catch {
      // Discord gameplay remains available if cloud storage has not been configured or is offline.
      session = null;
    }
    return NextResponse.json({ access_token: token.access_token, session }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Discord token exchange is unavailable." }, { status: 502 });
  }
}
