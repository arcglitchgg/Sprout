-- Apply after 20260927_ascended_fusion.sql. Save V3 adds fighter level and cumulative XP.
begin;

create or replace function public.write_sprout_save(
  p_user_id text, p_save jsonb, p_expected_revision bigint, p_farm_level smallint, p_coins bigint
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_revision bigint; v_updated_at timestamptz;
begin
  if p_save->>'version' <> '3' then return jsonb_build_object('revision', null); end if;
  if p_expected_revision is null then
    insert into public.game_saves(discord_user_id, save_version, save_data)
    values (p_user_id, 3, p_save)
    on conflict do nothing
    returning revision, updated_at into v_revision, v_updated_at;
  else
    update public.game_saves
    set save_data = p_save, save_version = 3, revision = revision + 1, updated_at = now()
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

-- PvP snapshots retain level/XP while base stats remain unchanged. Battle creation derives effective stats.
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
    or saved.save_data->>'version'<>'3' then return jsonb_build_object('error','conflict'); end if;
  select jsonb_agg(jsonb_build_object('id',f->>'id','crop',f->>'crop','mutation',f->>'mutation',
    'personality',f->>'personality','hp',(f->>'hp')::numeric,'attack',(f->>'attack')::numeric,
    'defense',(f->>'defense')::numeric,'speed',(f->>'speed')::numeric,
    'level',(f->>'level')::integer,'xp',(f->>'xp')::bigint) order by chosen.ordinality)
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
end;
$$;

commit;
