-- Apply after 20260924_farm_movement_broadcast.sql. All access is via trusted Next.js routes.
grant execute on function public.can_join_sprout_farm(text,text) to service_role;
create table if not exists public.live_pvp_matches (
  id uuid primary key,
  challenger_id text not null references public.players(discord_user_id) on delete cascade,
  opponent_id text not null references public.players(discord_user_id) on delete cascade,
  farm_owner_id text not null references public.players(discord_user_id) on delete cascade,
  status text not null check (status in ('pending_acceptance','waiting_for_teams','ready','active','cancelled','expired')),
  challenger_team jsonb,
  opponent_team jsonb,
  battle_id uuid unique,
  battle_seed bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 minutes'),
  check (challenger_id <> opponent_id)
);
create index if not exists live_pvp_matches_expiry on public.live_pvp_matches(expires_at) where status in ('pending_acceptance','waiting_for_teams');
alter table public.live_pvp_matches enable row level security;
revoke all on public.live_pvp_matches from public, anon, authenticated;
grant select, insert, update on public.live_pvp_matches to service_role;

create or replace function public.create_sprout_pvp(p_id uuid, p_actor text, p_other text, p_owner text)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  if p_actor = p_other or not public.can_join_sprout_farm('farm:'||p_owner,p_actor)
    or not public.can_join_sprout_farm('farm:'||p_owner,p_other)
    then return jsonb_build_object('error','forbidden'); end if;
  insert into public.live_pvp_matches(id,challenger_id,opponent_id,farm_owner_id,status)
  values(p_id,p_actor,p_other,p_owner,'pending_acceptance') on conflict do nothing;
  if not found then return jsonb_build_object('error','conflict'); end if;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.accept_sprout_pvp(p_id uuid, p_actor text)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  update public.live_pvp_matches set status='waiting_for_teams', updated_at=now()
  where id=p_id and opponent_id=p_actor and status='pending_acceptance' and expires_at>now()
    and public.can_join_sprout_farm('farm:'||farm_owner_id,challenger_id)
    and public.can_join_sprout_farm('farm:'||farm_owner_id,opponent_id);
  if not found then return jsonb_build_object('error','conflict'); end if;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.cancel_sprout_pvp(p_id uuid, p_actor text)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  update public.live_pvp_matches set status='cancelled', updated_at=now()
  where id=p_id and p_actor in (challenger_id,opponent_id)
    and status in ('pending_acceptance','waiting_for_teams');
  return jsonb_build_object('ok',found);
end; $$;

create or replace function public.submit_sprout_pvp_team(p_id uuid, p_actor text, p_ids text[], p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m public.live_pvp_matches%rowtype; saved public.game_saves%rowtype; team jsonb;
begin
  if p_ids is null or cardinality(p_ids)<>3 or (select count(distinct id) from unnest(p_ids) id)<>3
    or exists(select 1 from unnest(p_ids) id where id is null or id='') then return jsonb_build_object('error','invalid'); end if;
  select * into m from public.live_pvp_matches where id=p_id for update;
  if not found or p_actor not in (m.challenger_id,m.opponent_id) or m.status<>'waiting_for_teams' or m.expires_at<=now()
    then return jsonb_build_object('error','conflict'); end if;
  select * into saved from public.game_saves where discord_user_id=p_actor;
  if not found or p_expected_revision is null or saved.revision<>p_expected_revision
    or saved.save_data->>'version'<>'2' then return jsonb_build_object('error','conflict'); end if;
  select jsonb_agg(jsonb_build_object('id',f->>'id','crop',f->>'crop','mutation',f->>'mutation',
    'personality',f->>'personality','hp',(f->>'hp')::numeric,'attack',(f->>'attack')::numeric,
    'defense',(f->>'defense')::numeric,'speed',(f->>'speed')::numeric) order by chosen.ordinality)
    into team from unnest(p_ids) with ordinality chosen(id,ordinality)
    join jsonb_array_elements(saved.save_data->'game'->'fighters') f on f->>'id'=chosen.id;
  if jsonb_array_length(coalesce(team,'[]'::jsonb))<>3 then return jsonb_build_object('error','invalid'); end if;
  if p_actor=m.challenger_id then
    if m.challenger_team is not null then return jsonb_build_object('error','conflict'); end if;
    update public.live_pvp_matches set challenger_team=team,updated_at=now() where id=p_id;
  else
    if m.opponent_team is not null then return jsonb_build_object('error','conflict'); end if;
    update public.live_pvp_matches set opponent_team=team,updated_at=now() where id=p_id;
  end if;
  update public.live_pvp_matches set status='ready', battle_id=gen_random_uuid(), battle_seed=floor(random()*4294967296)::bigint,
    expires_at=now()+interval '1 hour',updated_at=now()
    where id=p_id and status='waiting_for_teams' and challenger_team is not null and opponent_team is not null;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.get_sprout_pvp(p_id uuid,p_actor text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m public.live_pvp_matches%rowtype;
begin
  update public.live_pvp_matches set status='expired',updated_at=now()
    where id=p_id and status in ('pending_acceptance','waiting_for_teams','ready') and expires_at<=now();
  select * into m from public.live_pvp_matches where id=p_id and p_actor in (challenger_id,opponent_id);
  if not found then return null; end if;
  return jsonb_build_object('id',m.id,'challengerId',m.challenger_id,'opponentId',m.opponent_id,
    'status',m.status,'battleId',m.battle_id,'battleSeed',m.battle_seed,
    'challengerTeam',case when m.status in ('ready','active') then m.challenger_team else null end,
    'opponentTeam',case when m.status in ('ready','active') then m.opponent_team else null end,
    'expiresAt',m.expires_at);
end; $$;

revoke all on function public.create_sprout_pvp(uuid,text,text,text),public.accept_sprout_pvp(uuid,text),
  public.cancel_sprout_pvp(uuid,text),public.submit_sprout_pvp_team(uuid,text,text[],bigint),public.get_sprout_pvp(uuid,text)
  from public,anon,authenticated;
grant execute on function public.create_sprout_pvp(uuid,text,text,text),public.accept_sprout_pvp(uuid,text),
  public.cancel_sprout_pvp(uuid,text),public.submit_sprout_pvp_team(uuid,text,text[],bigint),public.get_sprout_pvp(uuid,text)
  to service_role;
