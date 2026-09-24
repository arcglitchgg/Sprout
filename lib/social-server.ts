import "server-only";
import { sessionUserFromRequest } from "@/lib/discord-session";
import { readCloudSave, supabaseRequest } from "@/lib/supabase-admin";
import { migrateSproutSave } from "@/lib/save-storage";
import { buildDefenseSnapshot, calculateCombatPower, canChangeFriendship, canonicalFriendPair, publicProfile, sanitizeFarmSnapshot } from "@/lib/social";
import type { DefenseFighter, DefenseTeam, FriendAction, FriendLists } from "@/lib/social-types";

export class SocialError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function socialRoute(request: Request, handler: (actor: string) => Promise<unknown>) {
  const headers = { "Cache-Control": "no-store" };
  const actor = sessionUserFromRequest(request);
  if (!actor) return Response.json({ error: "Your Sprout session expired. Reopen the Activity to reconnect." }, { status: 401, headers });
  try { return Response.json(await handler(actor), { headers }); }
  catch (error) {
    return Response.json({ error: error instanceof SocialError ? error.message : "Neighborhood is unavailable. Please try again." }, { status: error instanceof SocialError ? error.status : 503, headers });
  }
}

export async function socialBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 8192) throw new SocialError(413, "Request too large.");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Return the same safe error for malformed bodies. */ }
  throw new SocialError(400, "A JSON object is required.");
}

async function database(path: string, body?: Record<string, unknown>): Promise<unknown> {
  const response = await supabaseRequest(path, body ? { method: "POST", body: JSON.stringify(body) } : undefined);
  if (!response.ok) throw new SocialError(503, "Neighborhood is unavailable. Please try again.");
  return response.json();
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== "object")) throw new Error("Invalid database response.");
  return value as Record<string, unknown>[];
}

function checkMutation(result: unknown) {
  if (!result || typeof result !== "object") throw new Error("Invalid database response.");
  if ("error" in result) {
    if (result.error === "missing") throw new SocialError(404, "Player or cloud save not found.");
    if (result.error === "invalid") throw new SocialError(400, "That selection is no longer valid.");
    throw new SocialError(409, "This changed while you were viewing it. Refresh and try again.");
  }
  if (!("ok" in result) || result.ok !== true) throw new Error("Invalid database response.");
}

export async function searchPlayers(actor: string, query: string) {
  const q = query.trim();
  if (q.length < 2 || q.length > 64) throw new SocialError(400, "Search with 2–64 characters.");
  const found = rows(await database("rpc/search_sprout_players", { p_actor: actor, p_query: q }));
  return { players: found.filter((row) => row.discord_user_id !== actor).slice(0, 20).map(publicProfile) };
}

export async function lookupPlayerNames(rawIds: string) {
  const ids = [...new Set(rawIds.split(","))];
  if (ids.length > 20 || ids.some((id) => !/^\d{5,25}$/.test(id))) throw new SocialError(400, "Invalid player IDs.");
  const found = rows(await database(`players?discord_user_id=in.(${ids.join(",")})&select=discord_user_id,username,display_name`));
  return { players: found.map((row) => ({ userId: String(row.discord_user_id), username: String(row.username), displayName: typeof row.display_name === "string" ? row.display_name : null })) };
}

export async function listFriends(actor: string): Promise<FriendLists> {
  const links = rows(await database(`friend_links?or=(user_low.eq.${actor},user_high.eq.${actor})&select=user_low,user_high,requested_by,status&order=created_at.desc`));
  const ids = [...new Set(links.map((link) => link.user_low === actor ? link.user_high : link.user_low))];
  const result: FriendLists = { friends: [], incoming: [], outgoing: [] };
  if (!ids.length) return result;
  const profiles = rows(await database(`players?discord_user_id=in.(${ids.join(",")})&select=discord_user_id,username,display_name,avatar,farm_level,coins,combat_power,pvp_wins`)).map(publicProfile);
  for (const link of links) {
    const profile = profiles.find((p) => p.userId === (link.user_low === actor ? link.user_high : link.user_low));
    if (profile) result[link.status === "accepted" ? "friends" : link.requested_by === actor ? "outgoing" : "incoming"].push(profile);
  }
  return result;
}

export async function changeFriendship(actor: string, other: string, action: FriendAction) {
  let pair: readonly [string, string];
  try { pair = canonicalFriendPair(actor, other); } catch { throw new SocialError(400, "Choose another Sprout player."); }
  const current = rows(await database(`friend_links?user_low=eq.${pair[0]}&user_high=eq.${pair[1]}&select=user_low,user_high,requested_by,status`))[0];
  const link = current ? { user_low: String(current.user_low), user_high: String(current.user_high), requested_by: String(current.requested_by), status: current.status as "pending" | "accepted" } : null;
  if (!canChangeFriendship(actor, action, link)) throw new SocialError(409, "That friendship action is no longer available. Refresh the list.");
  // SQL checks the state again; this read is only for friendly feedback.
  checkMutation(await database("rpc/change_sprout_friendship", { p_actor: actor, p_other: other, p_action: action }));
  return { ok: true };
}

export async function getDefenseTeam(actor: string): Promise<DefenseTeam> {
  const result = await database("rpc/get_sprout_defense", { p_owner: actor });
  if (!result || typeof result !== "object" || !("fighters" in result) || !("revision" in result)) throw new Error("Invalid defense response.");
  const fighters: DefenseFighter[] = rows(result.fighters).map((f) => ({ slot: Number(f.slot), id: String(f.fighter_id), crop: f.crop as DefenseFighter["crop"], mutation: f.mutation as DefenseFighter["mutation"], personality: f.personality as DefenseFighter["personality"], hp: Number(f.hp), attack: Number(f.attack), defense: Number(f.defense), speed: Number(f.speed), level: Number(f.level ?? 1), xp: Number(f.xp ?? 0) }));
  return { fighters, combatPower: calculateCombatPower(fighters), sourceSaveRevision: typeof result.revision === "number" ? result.revision : null };
}

export async function setDefenseTeam(actor: string, ids: unknown) {
  const saved = await readCloudSave(actor);
  const save = saved ? migrateSproutSave(saved.save) : null;
  if (!saved || !save) throw new SocialError(409, "Wait for your farm to sync to the cloud, then try again.");
  try { buildDefenseSnapshot(save.game.fighters, ids); }
  catch (error) { throw new SocialError(400, error instanceof Error ? error.message : "Invalid fighters."); }
  // The RPC locks this same save revision, rechecks IDs, and copies stats from the stored JSON.
  checkMutation(await database("rpc/set_sprout_defense", { p_owner: actor, p_ids: ids, p_expected_revision: saved.revision }));
  return getDefenseTeam(actor);
}

export async function getFriendFarm(actor: string, other: string) {
  try { canonicalFriendPair(actor, other); } catch { throw new SocialError(400, "Choose a friend's farm."); }
  const data = await database("rpc/get_sprout_friend_farm", { p_actor: actor, p_other: other });
  if (!data || typeof data !== "object" || !("profile" in data) || !("save" in data)) throw new SocialError(403, "Only accepted friends with a cloud save can be visited.");
  const save = migrateSproutSave(data.save);
  if (!save || !data.profile || typeof data.profile !== "object") throw new SocialError(503, "This farm cannot be loaded yet.");
  return sanitizeFarmSnapshot(publicProfile(data.profile as Record<string, unknown>), save);
}
