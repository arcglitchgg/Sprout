import "server-only";
import type { SproutSaveV2 } from "@/lib/save-types";

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Cloud storage is not configured.");
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

export async function upsertPlayerProfile(profile: { id: string; username: string; displayName: string | null; avatar: string | null }) {
  const response = await supabaseRequest("rpc/upsert_sprout_profile", {
    method: "POST",
    body: JSON.stringify({ p_user_id: profile.id, p_username: profile.username, p_display_name: profile.displayName, p_avatar: profile.avatar }),
  });
  if (!response.ok) throw new Error("Could not update cloud player profile.");
}

export async function readCloudSave(userId: string): Promise<{ save: unknown; revision: number; updatedAt: string } | null> {
  const response = await supabaseRequest(`game_saves?discord_user_id=eq.${encodeURIComponent(userId)}&select=save_data,revision,updated_at`);
  if (!response.ok) throw new Error("Cloud save is unavailable.");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  if (!row || typeof row !== "object" || !("save_data" in row) || !("revision" in row) || !("updated_at" in row) || typeof row.revision !== "number" || typeof row.updated_at !== "string") throw new Error("Cloud save response is invalid.");
  return { save: row.save_data, revision: row.revision, updatedAt: row.updated_at };
}

export async function writeCloudSave(userId: string, save: SproutSaveV2, revision: number | null): Promise<{ revision: number; updatedAt: string } | "conflict"> {
  const response = await supabaseRequest("rpc/write_sprout_save", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_save: save, p_expected_revision: revision, p_farm_level: Math.min(10, [0, 40, 100, 180, 300, 450, 650, 900, 1200, 1600].filter((threshold) => save.game.farmXp >= threshold).length), p_coins: save.game.coins }),
  });
  if (!response.ok) throw new Error("Cloud save write failed.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("revision" in result)) throw new Error("Cloud save response is invalid.");
  if (result.revision === null) return "conflict";
  if (typeof result.revision !== "number" || !("updated_at" in result) || typeof result.updated_at !== "string") throw new Error("Cloud save response is invalid.");
  return { revision: result.revision, updatedAt: result.updated_at };
}
