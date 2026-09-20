import { getUnlockedPlotCount } from "@/lib/progression";
import type { Fighter } from "@/lib/game-types";
import type { SproutSaveV2 } from "@/lib/save-types";
import type { DefenseFighter, FriendAction, FriendFarmSnapshot, SproutProfile, WorldContext } from "@/lib/social-types";

export const isPlayerId = (id: unknown): id is string => typeof id === "string" && /^\d{5,25}$/.test(id);

export function canonicalFriendPair(actor: string, other: string) {
  if (!isPlayerId(actor) || !isPlayerId(other) || actor === other) throw new Error("Choose another Sprout player.");
  return actor < other ? [actor, other] as const : [other, actor] as const;
}

export function canChangeFriendship(actor: string, action: FriendAction, link: { user_low: string; user_high: string; requested_by: string; status: "pending" | "accepted" } | null) {
  if (!link) return action === "request";
  if (actor !== link.user_low && actor !== link.user_high) return false;
  if (action === "request") return false;
  if (action === "remove") return link.status === "accepted";
  return link.status === "pending" && (action === "cancel" ? actor === link.requested_by : actor !== link.requested_by);
}

export function calculateCombatPower(fighters: readonly Fighter[]) {
  const power = Math.round(fighters.reduce((sum, f) => sum + 0.2 * f.hp + 4 * f.attack + 3 * f.defense + 2 * f.speed, 0));
  if (!Number.isSafeInteger(power) || power < 0 || power > 2147483647) throw new Error("Defense stats are out of range.");
  return power;
}

export function buildDefenseSnapshot(roster: readonly Fighter[], ids: unknown): DefenseFighter[] {
  if (!Array.isArray(ids) || ids.length > 3 || ids.some((id) => typeof id !== "string" || id.length === 0 || id.length > 128) || new Set(ids).size !== ids.length) throw new Error("Select up to three different fighters.");
  const snapshot = ids.map((id, slot) => {
    const fighter = roster.find((entry) => entry.id === id);
    if (!fighter) throw new Error("A fighter is not in your latest cloud save. Wait for save sync, then try again.");
    return { slot, id: fighter.id, crop: fighter.crop, mutation: fighter.mutation, personality: fighter.personality, hp: fighter.hp, attack: fighter.attack, defense: fighter.defense, speed: fighter.speed };
  });
  calculateCombatPower(snapshot);
  return snapshot;
}

export function publicProfile(row: Record<string, unknown>): SproutProfile {
  return {
    userId: String(row.discord_user_id), username: String(row.username),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    avatar: typeof row.avatar === "string" ? row.avatar : null,
    farmLevel: Number(row.farm_level), coins: Number(row.coins), combatPower: Number(row.combat_power), pvpWins: Number(row.pvp_wins),
  };
}

export function sanitizeFarmSnapshot(owner: SproutProfile, save: SproutSaveV2): FriendFarmSnapshot {
  const unlockedPlotCount = getUnlockedPlotCount(save.game.farmXp);
  return {
    owner: { userId: owner.userId, username: owner.username, displayName: owner.displayName, avatar: owner.avatar, farmLevel: owner.farmLevel, coins: owner.coins, combatPower: owner.combatPower, pvpWins: owner.pvpWins },
    farmXp: save.game.farmXp, unlockedPlotCount,
    plots: save.game.plots.filter((plot) => plot.id < unlockedPlotCount).map(({ id, crop, plantedAt }) => ({ id, crop, plantedAt })),
  };
}

export const canModifyFarm = (context: WorldContext) => context.mode === "own-farm";
