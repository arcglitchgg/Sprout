# Cloud save setup

1. Run `migrations/20260920_cloud_saves.sql` in the Supabase SQL editor before enabling cloud saves.
2. Set these in local `.env.local` and Vercel Production (and Preview if used):
   - `NEXT_PUBLIC_DISCORD_CLIENT_ID` — public Discord application ID.
   - `DISCORD_CLIENT_SECRET` — server-only Discord OAuth secret.
   - `SUPABASE_URL` — Supabase project URL, used only by Next.js routes.
   - `SUPABASE_SECRET_KEY` — server-only Supabase secret key with service-role privileges.
   - `SPROUT_SESSION_SECRET` — server-only random signing secret of at least 32 characters.
3. Never commit `.env.local`. Do not prefix Supabase credentials or the session secret with `NEXT_PUBLIC_`.

Direct browser access to `players` and `game_saves` is disabled. Save requests authenticate with a short-lived Sprout bearer session held only in React memory. Standalone mode continues to use localStorage only. Cloud save payloads remain client-generated and are not anti-cheat authoritative.

## Neighborhood milestone

Apply `migrations/20260921_social.sql` after the cloud-save migration. It adds canonical friendships, search indexes, defense snapshots, and server-only RPCs. The save trigger refreshes defense snapshots and prunes fused/deleted fighters inside the existing save transaction. No Save V2 schema change or new environment variables are needed.

Walk to the top-middle Friends exit to search for players, manage requests, set defense, or visit an accepted friend's saved farm. Visiting is read-only; Return Home restores the player's home position. The static owner is an offline representation, and challenges are placeholders. Standalone mode shows an unavailable message without issuing social API requests.

Defense validates IDs against the latest cloud save. Recently awakened/fused fighters may need the existing cloud autosave to finish before defense setup succeeds. Combat Power is the rounded team total of `0.2 * hp + 4 * attack + 3 * defense + 2 * speed`; it remains based on client-generated saved stats, not an anti-cheat guarantee.

Run `npm run test:social` for local PostgreSQL migration/constraint tests and API/world isolation tests. These use a temporary in-memory PGlite database and never connect to the configured Supabase project. Live cross-account Discord testing still requires the migration to be applied to that project. Sessions retain the existing one-hour lifetime; a 401 asks the player to reopen the Activity.

## Farm Presence Phase 1

Apply `migrations/20260922_farm_presence.sql` after the social migration. Configure Supabase Realtime to disallow public channels. Private `farm:<owner Discord ID>` Presence channels allow the owner and accepted friends only; Broadcast is not enabled.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in local/Vercel client environments. Keep `SUPABASE_SECRET_KEY` server-only for the existing APIs. Import an ES256 P-256 JWT signing key into the Supabase project's JWT Signing Keys (activate it as directed by Supabase), and set `SUPABASE_REALTIME_SIGNING_JWK` to that same private JWK JSON **only on the Next.js server**. The JWK must include its `kid`. Never use a publishable key or the Sprout session secret as the signing key. The server verifies the existing Sprout session and signs a five-minute JWT with the server-derived Discord ID and `authenticated` role. The browser refreshes its room connection before expiry. If Realtime variables or signing are absent, the game continues without online presence.

Presence carries only `userId`, `isOwner`, and `joinedAt`; it does not update Save V2. The visitor keeps the saved owner NPC pose, adding an online dot when owner Presence appears. A room member can still forge those visual payload fields, so Presence must not authorize gameplay, writes, or identity-sensitive features.
