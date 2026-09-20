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
