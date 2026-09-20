import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const LIFETIME_SECONDS = 60 * 60;

export function createSproutSession(userId: string, now = Date.now(), secret = process.env.SPROUT_SESSION_SECRET) {
  if (!secret || secret.length < 32 || !/^\d{5,25}$/.test(userId)) throw new Error("Session configuration or identity is invalid.");
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + LIFETIME_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySproutSession(token: string | null, now = Date.now(), secret = process.env.SPROUT_SESSION_SECRET): string | null {
  if (!token || !secret || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest();
  let actual: Buffer;
  try { actual = Buffer.from(parts[1], "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || !("sub" in payload) || !("iat" in payload) || !("exp" in payload)) return null;
    const { sub, iat, exp } = payload;
    const seconds = Math.floor(now / 1000);
    return typeof sub === "string" && /^\d{5,25}$/.test(sub) && typeof iat === "number" && typeof exp === "number" && iat <= seconds && exp > seconds && exp - iat <= LIFETIME_SECONDS ? sub : null;
  } catch { return null; }
}

export function sessionUserFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? verifySproutSession(header.slice(7)) : null;
}
