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
