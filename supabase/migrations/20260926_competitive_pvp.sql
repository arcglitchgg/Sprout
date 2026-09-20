-- Apply after 20260925_live_pvp.sql. Reusing completed match rows retains combat snapshots.
begin;
alter table public.live_pvp_matches drop constraint if exists live_pvp_matches_status_check;
alter table public.live_pvp_matches add constraint live_pvp_matches_status_check
  check (status in ('pending_acceptance','waiting_for_teams','ready','active','completed','cancelled','expired'));
alter table public.live_pvp_matches add column if not exists result text
  check (result in ('challenger','opponent','draw'));
alter table public.live_pvp_matches add column if not exists winner_id text references public.players(discord_user_id);
alter table public.live_pvp_matches add column if not exists completed_at timestamptz;
create index if not exists live_pvp_challenger_history on public.live_pvp_matches(challenger_id,completed_at desc) where status='completed';
create index if not exists live_pvp_opponent_history on public.live_pvp_matches(opponent_id,completed_at desc) where status='completed';
create index if not exists players_money_rank on public.players(coins desc,discord_user_id);
create index if not exists players_power_rank on public.players(combat_power desc,discord_user_id);
create index if not exists players_wins_rank on public.players(pvp_wins desc,discord_user_id);

-- A second viewer may still be presenting the battle after the first viewer finalizes.
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
    'challengerTeam',case when m.status in ('ready','active','completed') then m.challenger_team else null end,
    'opponentTeam',case when m.status in ('ready','active','completed') then m.opponent_team else null end,
    'expiresAt',m.expires_at);
end; $$;

-- Match lock serializes simultaneous clients; the win projection changes in this transaction only.
create or replace function public.finalize_sprout_pvp(p_id uuid,p_actor text,p_result text,p_winner text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m public.live_pvp_matches%rowtype; wins integer;
begin
  select * into m from public.live_pvp_matches where id=p_id for update;
  if not found or p_actor not in (m.challenger_id,m.opponent_id) then return jsonb_build_object('error','forbidden'); end if;
  if m.status='completed' then
    select pvp_wins into wins from public.players where discord_user_id=p_actor;
    return jsonb_build_object('result',m.result,'winnerId',m.winner_id,'pvpWins',wins,'completedAt',m.completed_at);
  end if;
  if m.status not in ('ready','active') or m.expires_at<=now() or m.challenger_team is null or m.opponent_team is null
    or m.battle_id is null or m.battle_seed is null then return jsonb_build_object('error','conflict'); end if;
  if p_result not in ('challenger','opponent','draw') or
     (p_result='challenger' and p_winner is distinct from m.challenger_id) or
     (p_result='opponent' and p_winner is distinct from m.opponent_id) or
     (p_result='draw' and p_winner is not null) then return jsonb_build_object('error','invalid'); end if;
  update public.live_pvp_matches set status='completed',result=p_result,winner_id=p_winner,
    completed_at=now(),updated_at=now() where id=p_id;
  if p_winner is not null then update public.players set pvp_wins=pvp_wins+1,updated_at=now() where discord_user_id=p_winner; end if;
  select pvp_wins into wins from public.players where discord_user_id=p_actor;
  return jsonb_build_object('result',p_result,'winnerId',p_winner,'pvpWins',wins,
    'completedAt',(select completed_at from public.live_pvp_matches where id=p_id));
end; $$;

-- Only a participant may receive their own recent results; no team/save JSON leaves this function.
create or replace function public.get_sprout_pvp_history(p_actor text)
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'opponent',to_jsonb(p),
    'result',case when m.result='draw' then 'draw' when m.winner_id=p_actor then 'win' else 'loss' end,
    'completedAt',m.completed_at) order by m.completed_at desc,m.id), '[]'::jsonb)
  from (select * from public.live_pvp_matches
    where status='completed' and p_actor in (challenger_id,opponent_id)
    order by completed_at desc,id limit 30) m
  join public.players p on p.discord_user_id=case when m.challenger_id=p_actor then m.opponent_id else m.challenger_id end;
$$;

-- Rank the complete eligible population first, then trim to 50 while preserving the actor's rank.
create or replace function public.get_sprout_leaderboard(p_actor text,p_category text,p_scope text)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare output jsonb;
begin
  if p_category not in ('money','combat-power','pvp-wins') or p_scope not in ('global','friends') then
    return jsonb_build_object('error','invalid'); end if;
  with eligible as (
    select p.*,case p_category when 'money' then p.coins when 'combat-power' then p.combat_power else p.pvp_wins end as metric
    from public.players p where p_scope='global' or p.discord_user_id=p_actor or exists (
      select 1 from public.friend_links f where f.status='accepted'
        and f.user_low=least(p_actor,p.discord_user_id) and f.user_high=greatest(p_actor,p.discord_user_id))
  ), ranked as (
    select *,row_number() over(order by metric desc,discord_user_id asc) as rank from eligible
  ) select jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',r.rank,'player',to_jsonb(r)-'metric'-'rank',
      'value',r.metric) order by r.rank) from ranked r where r.rank<=50),'[]'::jsonb),
    'currentPlayer',(select jsonb_build_object('rank',r.rank,'value',r.metric) from ranked r where r.discord_user_id=p_actor)
  ) into output;
  return output;
end; $$;

revoke all on function public.finalize_sprout_pvp(uuid,text,text,text),
  public.get_sprout_pvp_history(text),public.get_sprout_leaderboard(text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_sprout_pvp(uuid,text,text,text),
  public.get_sprout_pvp_history(text),public.get_sprout_leaderboard(text,text,text) to service_role;
commit;
