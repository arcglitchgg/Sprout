import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

export const REALTIME_TOKEN_SECONDS = 300;

export function createRealtimeToken(userId: string, now = Date.now(), keyJson = process.env.SUPABASE_REALTIME_SIGNING_JWK) {
  if (!/^\d{5,25}$/.test(userId) || !keyJson) throw new Error("Realtime signing is not configured.");
  const jwk = JSON.parse(keyJson) as NodeJsonWebKey & { kid?: string };
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.kid) throw new Error("Invalid Realtime signing key.");
  const seconds = Math.floor(now / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "ES256", typ: "JWT", kid: jwk.kid });
  // Supabase documents `sub` as an optional UUID. Discord IDs are decimal strings,
  // so the verified identity is carried only in this custom claim.
  const payload = encode({ discord_user_id: userId, role: "authenticated", aud: "authenticated", iss: "sprout", iat: seconds, exp: seconds + REALTIME_TOKEN_SECONDS });
  const content = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(content), { key: createPrivateKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return { token: `${content}.${signature}`, expiresAt: (seconds + REALTIME_TOKEN_SECONDS) * 1000 };
}
