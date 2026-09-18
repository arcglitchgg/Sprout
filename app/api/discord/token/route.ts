import { NextResponse } from "next/server";

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
    return NextResponse.json({ access_token: token.access_token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Discord token exchange is unavailable." }, { status: 502 });
  }
}
