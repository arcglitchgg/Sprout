export const CHALLENGE_MS = 15_000;
export type ChallengeEvent = "challenge-request" | "challenge-accept" | "challenge-decline" | "challenge-cancel" | "challenge-busy";
export type ChallengePacket = { challengeId: string; fromUserId: string; toUserId: string; createdAt: number; expiresAt: number };
export type ChallengeState = { role: "outgoing" | "incoming"; status: "pending" | "accepted"; packet: ChallengePacket };

const idPattern = /^\d{5,25}$/;
export function validChallengePacket(value: unknown, members: ReadonlySet<string>, now: number): value is ChallengePacket {
  if (!value || typeof value !== "object") return false;
  const packet = value as Partial<ChallengePacket>;
  return typeof packet.challengeId === "string" && /^[a-zA-Z0-9-]{8,80}$/.test(packet.challengeId)
    && typeof packet.fromUserId === "string" && idPattern.test(packet.fromUserId)
    && typeof packet.toUserId === "string" && idPattern.test(packet.toUserId)
    && packet.fromUserId !== packet.toUserId && members.has(packet.fromUserId) && members.has(packet.toUserId)
    && Number.isSafeInteger(packet.createdAt) && Number.isSafeInteger(packet.expiresAt)
    && packet.createdAt! <= now + 5000 && packet.expiresAt! > now && packet.expiresAt! - packet.createdAt! <= CHALLENGE_MS;
}

export function playerInRange(a: { x: number; y: number }, b: { x: number; y: number }, radius = 90) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}

export function playerName(userId: string, profiles: Record<string, { displayName?: string | null; username?: string | null }>, owner?: { userId: string; displayName?: string | null; username?: string | null } | null) {
  const profile = owner?.userId === userId ? owner : profiles[userId];
  return profile?.displayName?.trim() || profile?.username?.trim() || `Farmer ...${userId.slice(-4)}`;
}
