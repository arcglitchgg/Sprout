create table public.players (
  discord_user_id text primary key check (discord_user_id ~ '^[0-9]{5,25}$'),
  username text not null,
  display_name text,
  avatar text,
  farm_level smallint not null default 1 check (farm_level between 1 and 10),
  coins bigint not null default 0 check (coins >= 0),
  combat_power integer not null default 0 check (combat_power >= 0),
  pvp_wins integer not null default 0 check (pvp_wins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_saves (
  discord_user_id text primary key references public.players(discord_user_id) on delete cascade,
  save_version smallint not null check (save_version > 0),
  save_data jsonb not null check (jsonb_typeof(save_data) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.game_saves enable row level security;
revoke all on public.players, public.game_saves from anon, authenticated;

create function public.upsert_sprout_profile(
  p_user_id text, p_username text, p_display_name text, p_avatar text
) returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.players(discord_user_id, username, display_name, avatar)
  values (p_user_id, p_username, p_display_name, p_avatar)
  on conflict (discord_user_id) do update
  set username = excluded.username, display_name = excluded.display_name,
      avatar = excluded.avatar, updated_at = now();
end;
$$;
revoke all on function public.upsert_sprout_profile(text, text, text, text) from public, anon, authenticated;
grant execute on function public.upsert_sprout_profile(text, text, text, text) to service_role;

-- A single transaction updates save and leaderboard projections. A null revision signals conflict.
create function public.write_sprout_save(
  p_user_id text, p_save jsonb, p_expected_revision bigint, p_farm_level smallint, p_coins bigint
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_revision bigint; v_updated_at timestamptz;
begin
  if p_expected_revision is null then
    insert into public.game_saves(discord_user_id, save_version, save_data)
    values (p_user_id, 2, p_save)
    on conflict do nothing
    returning revision, updated_at into v_revision, v_updated_at;
  else
    update public.game_saves
    set save_data = p_save, save_version = 2, revision = revision + 1, updated_at = now()
    where discord_user_id = p_user_id and revision = p_expected_revision
    returning revision, updated_at into v_revision, v_updated_at;
  end if;
  if v_revision is null then return jsonb_build_object('revision', null); end if;
  update public.players set coins = p_coins, farm_level = p_farm_level, updated_at = now()
    where discord_user_id = p_user_id;
  if not found then raise exception 'Player profile does not exist'; end if;
  return jsonb_build_object('revision', v_revision, 'updated_at', v_updated_at);
end;
$$;
revoke all on function public.write_sprout_save(text, jsonb, bigint, smallint, bigint) from public, anon, authenticated;
grant execute on function public.write_sprout_save(text, jsonb, bigint, smallint, bigint) to service_role;
