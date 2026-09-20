-- Apply after 20260920_cloud_saves.sql. All social access remains behind Next.js.
create extension if not exists pg_trgm with schema extensions;
create index players_username_search on public.players using gin (lower(username) extensions.gin_trgm_ops);
create index players_display_name_search on public.players using gin (lower(display_name) extensions.gin_trgm_ops);

create table public.friend_links (
  user_low text not null references public.players(discord_user_id) on delete cascade,
  user_high text not null references public.players(discord_user_id) on delete cascade,
  requested_by text not null references public.players(discord_user_id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);
create index friend_links_high_status on public.friend_links(user_high, status);
create index friend_links_low_status on public.friend_links(user_low, status);

create table public.defense_teams (
  owner_id text primary key references public.players(discord_user_id) on delete cascade,
  source_save_revision bigint not null check (source_save_revision > 0),
  updated_at timestamptz not null default now()
);
create table public.defense_fighters (
  owner_id text not null references public.defense_teams(owner_id) on delete cascade,
  slot smallint not null check (slot between 0 and 2),
  fighter_id text not null,
  crop text not null check (crop in ('potato', 'carrot', 'corn')),
  mutation text not null check (mutation in ('normal', 'large', 'golden', 'prismatic')),
  personality text not null check (personality in ('angry', 'protective', 'lazy', 'clever', 'mean')),
  hp numeric not null check (hp >= 0),
  attack numeric not null check (attack >= 0),
  defense numeric not null check (defense >= 0),
  speed numeric not null check (speed >= 0),
  primary key (owner_id, slot),
  unique (owner_id, fighter_id)
);
alter table public.friend_links enable row level security;
alter table public.defense_teams enable row level security;
alter table public.defense_fighters enable row level security;
revoke all on public.friend_links, public.defense_teams, public.defense_fighters from public, anon, authenticated;
grant select, insert, update, delete on public.friend_links, public.defense_teams, public.defense_fighters to service_role;

create function public.search_sprout_players(p_actor text, p_query text)
returns setof public.players language sql stable security invoker set search_path = public as $$
  select p.* from public.players p
  where p.discord_user_id <> p_actor and char_length(btrim(p_query)) between 2 and 64
    and (lower(p.username) like '%' || replace(replace(replace(lower(btrim(p_query)), chr(92), chr(92)||chr(92)), '%', chr(92)||'%'), '_', chr(92)||'_') || '%' escape E'\\'
      or lower(p.display_name) like '%' || replace(replace(replace(lower(btrim(p_query)), chr(92), chr(92)||chr(92)), '%', chr(92)||'%'), '_', chr(92)||'_') || '%' escape E'\\')
  order by lower(p.username), p.discord_user_id limit 20;
$$;

create function public.change_sprout_friendship(p_actor text, p_other text, p_action text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare lo text := least(p_actor, p_other); hi text := greatest(p_actor, p_other); changed integer;
begin
  if p_actor = p_other or p_actor is null or p_other is null then return jsonb_build_object('error', 'invalid'); end if;
  if not exists(select 1 from public.players where discord_user_id = p_other) then return jsonb_build_object('error', 'missing'); end if;
  if p_action = 'request' then
    insert into public.friend_links(user_low, user_high, requested_by, status) values(lo, hi, p_actor, 'pending') on conflict do nothing;
  elsif p_action = 'accept' then
    update public.friend_links set status = 'accepted', updated_at = now()
    where user_low = lo and user_high = hi and status = 'pending' and requested_by = p_other;
  elsif p_action = 'decline' then
    delete from public.friend_links where user_low = lo and user_high = hi and status = 'pending' and requested_by = p_other;
  elsif p_action = 'cancel' then
    delete from public.friend_links where user_low = lo and user_high = hi and status = 'pending' and requested_by = p_actor;
  elsif p_action = 'remove' then
    delete from public.friend_links where user_low = lo and user_high = hi and status = 'accepted';
  else return jsonb_build_object('error', 'invalid');
  end if;
  get diagnostics changed = row_count;
  if changed = 0 then return jsonb_build_object('error', 'conflict'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.get_sprout_friend_farm(p_actor text, p_other text)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('profile', to_jsonb(p), 'save', s.save_data)
  from public.friend_links f
  join public.players p on p.discord_user_id = p_other
  join public.game_saves s on s.discord_user_id = p_other
  where f.user_low = least(p_actor, p_other) and f.user_high = greatest(p_actor, p_other)
    and f.status = 'accepted' and p_actor <> p_other;
$$;

-- Called only in transactions holding the owner's game_saves row lock.
-- Refresh stats from the saved roster as well as pruning fighters removed by Fusion.
create function public.refresh_sprout_defense(p_owner text, p_save jsonb, p_revision bigint)
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.defense_fighters d where d.owner_id = p_owner
    and not exists(select 1 from jsonb_array_elements(p_save->'game'->'fighters') f where f->>'id' = d.fighter_id);
  update public.defense_fighters d set crop = f->>'crop', mutation = f->>'mutation', personality = f->>'personality',
    hp = (f->>'hp')::numeric, attack = (f->>'attack')::numeric, defense = (f->>'defense')::numeric, speed = (f->>'speed')::numeric
    from jsonb_array_elements(p_save->'game'->'fighters') f where d.owner_id = p_owner and d.fighter_id = f->>'id';
  update public.defense_teams set source_save_revision = p_revision, updated_at = now() where owner_id = p_owner;
  update public.players set combat_power = (
    select round(coalesce(sum(0.2 * hp + 4 * attack + 3 * defense + 2 * speed), 0))::integer
    from public.defense_fighters where owner_id = p_owner
  ), updated_at = now() where discord_user_id = p_owner;
end;
$$;

create function public.set_sprout_defense(p_owner text, p_ids text[], p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved public.game_saves%rowtype; found_count integer;
begin
  if p_ids is null or cardinality(p_ids) > 3 or exists(select 1 from unnest(p_ids) id where id is null or id = '')
    or (select count(distinct id) from unnest(p_ids) id) <> cardinality(p_ids) then return jsonb_build_object('error', 'invalid'); end if;
  select * into saved from public.game_saves where discord_user_id = p_owner for update;
  if not found then return jsonb_build_object('error', 'missing'); end if;
  if saved.revision <> p_expected_revision or p_expected_revision is null then return jsonb_build_object('error', 'conflict'); end if;
  select count(*) into found_count from jsonb_array_elements(saved.save_data->'game'->'fighters') f where f->>'id' = any(p_ids);
  if found_count <> cardinality(p_ids) then return jsonb_build_object('error', 'invalid'); end if;
  insert into public.defense_teams(owner_id, source_save_revision) values(p_owner, saved.revision)
    on conflict (owner_id) do update set source_save_revision = excluded.source_save_revision, updated_at = now();
  delete from public.defense_fighters where owner_id = p_owner;
  insert into public.defense_fighters(owner_id, slot, fighter_id, crop, mutation, personality, hp, attack, defense, speed)
    select p_owner, (chosen.ordinality - 1)::smallint, f->>'id', f->>'crop', f->>'mutation', f->>'personality',
      (f->>'hp')::numeric, (f->>'attack')::numeric, (f->>'defense')::numeric, (f->>'speed')::numeric
    from unnest(p_ids) with ordinality chosen(id, ordinality)
    join jsonb_array_elements(saved.save_data->'game'->'fighters') f on f->>'id' = chosen.id;
  perform public.refresh_sprout_defense(p_owner, saved.save_data, saved.revision);
  return jsonb_build_object('ok', true);
end;
$$;

create function public.sync_sprout_defense_after_save()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if exists(select 1 from public.defense_teams where owner_id = new.discord_user_id) then
    perform public.refresh_sprout_defense(new.discord_user_id, new.save_data, new.revision);
  end if;
  return new;
end;
$$;
-- Runs within write_sprout_save: a projection failure rolls the entire save back.
create trigger game_saves_sync_defense after insert or update of save_data on public.game_saves
  for each row execute function public.sync_sprout_defense_after_save();

create function public.get_sprout_defense(p_owner text)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'revision', (select source_save_revision from public.defense_teams where owner_id = p_owner),
    'fighters', (select coalesce(jsonb_agg(to_jsonb(d) order by d.slot), '[]'::jsonb) from public.defense_fighters d where d.owner_id = p_owner)
  );
$$;

revoke all on function public.search_sprout_players(text, text), public.change_sprout_friendship(text, text, text),
  public.get_sprout_friend_farm(text, text), public.refresh_sprout_defense(text, jsonb, bigint),
  public.set_sprout_defense(text, text[], bigint), public.sync_sprout_defense_after_save(), public.get_sprout_defense(text)
  from public, anon, authenticated;
grant execute on function public.search_sprout_players(text, text), public.change_sprout_friendship(text, text, text),
  public.get_sprout_friend_farm(text, text), public.refresh_sprout_defense(text, jsonb, bigint),
  public.set_sprout_defense(text, text[], bigint), public.sync_sprout_defense_after_save(), public.get_sprout_defense(text) to service_role;
