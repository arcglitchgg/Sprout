-- Apply after 20260921_social.sql. Safe if 20260922 was applied fully,
-- stopped after its function, or was never applied. Run this file instead of 20260922.
begin;

create or replace function public.can_join_sprout_farm(p_topic text, p_actor text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    p_topic ~ '^farm:[0-9]{5,25}$'
    and p_actor ~ '^[0-9]{5,25}$'
    and exists(select 1 from public.players where discord_user_id = p_actor)
    and (
      substring(p_topic from 6) = p_actor
      or exists (
        select 1 from public.friend_links f
        where f.user_low = least(p_actor, substring(p_topic from 6))
          and f.user_high = greatest(p_actor, substring(p_topic from 6))
          and f.status = 'accepted'
      )
    ), false
  );
$$;
revoke all on function public.can_join_sprout_farm(text, text) from public, anon, authenticated;
grant execute on function public.can_join_sprout_farm(text, text) to authenticated;

drop policy if exists sprout_farm_presence_read on realtime.messages;
drop policy if exists sprout_farm_presence_write on realtime.messages;
create policy sprout_farm_presence_read on realtime.messages
for select to authenticated using (
  extension = 'presence'
  and public.can_join_sprout_farm(realtime.topic(),
    current_setting('request.jwt.claims', true)::jsonb ->> 'discord_user_id')
);
create policy sprout_farm_presence_write on realtime.messages
for insert to authenticated with check (
  extension = 'presence'
  and public.can_join_sprout_farm(realtime.topic(),
    current_setting('request.jwt.claims', true)::jsonb ->> 'discord_user_id')
);

commit;
