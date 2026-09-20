import "server-only";
import { readCloudSave, supabaseRequest } from "@/lib/supabase-admin";
import { validateSproutSave } from "@/lib/save-storage";
import { SocialError } from "@/lib/social-server";
import type { LivePvpMatch } from "@/lib/pvp-types";

const userId = (value: unknown): value is string => typeof value === "string" && /^\d{5,25}$/.test(value);
const matchId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

async function rpc(name: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const response = await supabaseRequest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) throw new SocialError(503, "Friendly match is unavailable.");
  const result: unknown = await response.json();
  if (result === null) return null;
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new SocialError(503, "Invalid match response.");
  return result as Record<string, unknown>;
}

function check(result: Record<string, unknown> | null) {
  if (result?.ok === true) return;
  throw new SocialError(result?.error === "invalid" ? 400 : result?.error === "forbidden" ? 403 : 409, "Match is unavailable or has changed.");
}

export async function createPvpMatch(actor: string, body: Record<string, unknown>) {
  if (!matchId(body.challengeId) || !userId(body.opponentId) || !userId(body.farmOwnerId) || actor === body.opponentId) throw new SocialError(400, "Invalid challenge.");
  check(await rpc("create_sprout_pvp", { p_id: body.challengeId, p_actor: actor, p_other: body.opponentId, p_owner: body.farmOwnerId }));
  return { ok: true };
}

export async function acceptPvpMatch(actor: string, id: string) {
  if (!matchId(id)) throw new SocialError(400, "Invalid challenge.");
  check(await rpc("accept_sprout_pvp", { p_id: id, p_actor: actor }));
  return { ok: true };
}

export async function cancelPvpMatch(actor: string, id: string) {
  if (!matchId(id)) throw new SocialError(400, "Invalid challenge.");
  check(await rpc("cancel_sprout_pvp", { p_id: id, p_actor: actor }));
  return { ok: true };
}

export async function submitPvpTeam(actor: string, id: string, body: Record<string, unknown>) {
  if (!matchId(id) || !Array.isArray(body.fighterIds) || body.fighterIds.length !== 3 || body.fighterIds.some((value) => typeof value !== "string" || !value) || new Set(body.fighterIds).size !== 3) throw new SocialError(400, "Choose three distinct fighters.");
  const saved = await readCloudSave(actor);
  const save = saved?.save;
  if (!validateSproutSave(save)) throw new SocialError(409, "Wait for your cloud save to sync.");
  const ids = body.fighterIds as string[];
  if (ids.some((fighterId) => !save.game.fighters.some((fighter) => fighter.id === fighterId))) throw new SocialError(400, "A selected fighter is no longer in your roster.");
  // SQL locks the match and re-reads the latest save before copying fighter stats.
  check(await rpc("submit_sprout_pvp_team", { p_id: id, p_actor: actor, p_ids: ids, p_expected_revision: saved!.revision }));
  return { ok: true };
}

export async function getPvpMatch(actor: string, id: string): Promise<LivePvpMatch> {
  if (!matchId(id)) throw new SocialError(400, "Invalid challenge.");
  const match = await rpc("get_sprout_pvp", { p_id: id, p_actor: actor });
  if (!match) throw new SocialError(404, "Match not found.");
  return match as LivePvpMatch;
}
