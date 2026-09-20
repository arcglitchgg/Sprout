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

### Repairing a partial Presence migration

The original `20260922_farm_presence.sql` used plain `CREATE FUNCTION` and `CREATE POLICY`, so it cannot be rerun after any of those objects already exist. In the SQL Editor, inspect the current objects without reading credentials:

```sql
select to_regprocedure('public.can_join_sprout_farm(text,text)') as presence_function;
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'realtime' and tablename = 'messages'
  and policyname in ('sprout_farm_presence_read', 'sprout_farm_presence_write')
order by policyname;
```

Run `migrations/20260923_farm_presence_repair.sql` in the Supabase SQL Editor **instead of rerunning 20260922**. It replaces the function and recreates the two Presence policies in one transaction. It is safe if the original migration was applied fully, stopped after the function, or was never applied, and safe to rerun. The repair does not touch players, friendships, game saves, or defense teams. Rerun the inspection query afterward; it should return one function and two policies (`SELECT` and `INSERT`).

To diagnose the deployed Activity, set `NEXT_PUBLIC_REALTIME_DEBUG=1` for the Vercel environment under test and redeploy. Browser console messages prefixed `[Sprout Presence]` report token HTTP failures, authentication setup, subscription status, track result, and sync/join/leave counts. They never print tokens, keys, payloads, or Discord IDs. `token-fetch-failed: 401` means the Sprout session expired; `503` points to server signing configuration. `token-or-channel-rejected` means to check the Supabase signing-key `kid`, active key status, policies, and accepted friendship. `socket-or-network-failed` points to the Realtime connection. `subscribed` followed by `presence-track-ok` and `presence-synced` confirms the client path. Remove the debug flag and redeploy after testing.

Verify that the Supabase project's Realtime setting disallows public channels, the imported ES256 key is active, and the server JWK's `kid` matches that key. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must be configured for the same project in Vercel and available at build time. `SUPABASE_REALTIME_SIGNING_JWK` stays server-only. These are configuration checks; local tests cannot prove a deployed Supabase project accepts the token.

## Friendly live PvP setup

Apply `migrations/20260925_live_pvp.sql` after the Presence repair and movement Broadcast migrations. It adds a server-only match table and RPCs. No new environment variables or Save V2 fields are needed. The migration is safe to rerun.

The challenger creates a pending match, then the intended recipient confirms it through an authenticated route. Each player submits only three fighter IDs; the server checks the latest validated cloud save revision and SQL copies the selected fighter stats from that save. After both teams arrive, SQL generates one battle ID and seed. Both clients poll the authenticated match API for the same snapshot and run the existing seeded engine locally. Movement and challenge Broadcast packets are wakeup signals, not authoritative battle data. With only this migration, friendly battles award no coins, XP, or PvP wins. Pending setup expires after three minutes; ready snapshots expire after one hour. Live two-client behavior still requires testing in Discord after applying the migration.

## Competitive PvP results and leaderboards

Apply `migrations/20260926_competitive_pvp.sql` after `20260925_live_pvp.sql`. It extends the existing match record with completion fields and retained combat snapshots. The authenticated completion route ignores request body results and replays the stored teams and seed on the server. A row-locked SQL transaction marks the match completed and increments the winner's `players.pvp_wins` once; retries return the recorded result. Draws award no win. PvP grants no coins or Farm XP. Completed matches remain available to both participants while the slower battle presentation finishes.

The Neighborhood overlay shows global/friends Top 50 money, Combat Power, and PvP Wins rankings, the current player's rank, and recent completed matches. Profile and ranking data comes from server projections; no Save V2 fields or new environment variables are required. Existing cloud-save stat projections are still based on client-generated saves and are not an anti-cheat authority.
