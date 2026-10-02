-- Apply after 20260928_save_v3_fighter_progression.sql. Farm Level is unbounded prestige after Level 10.
begin;

alter table public.players drop constraint if exists players_farm_level_check;
alter table public.players alter column farm_level type integer;
alter table public.players add constraint players_farm_level_check check (farm_level >= 1);

drop function if exists public.write_sprout_save(text, jsonb, bigint, smallint, bigint);
create function public.write_sprout_save(
  p_user_id text, p_save jsonb, p_expected_revision bigint, p_farm_level integer, p_coins bigint
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

revoke all on function public.write_sprout_save(text, jsonb, bigint, integer, bigint) from public, anon, authenticated;
grant execute on function public.write_sprout_save(text, jsonb, bigint, integer, bigint) to service_role;

commit;
