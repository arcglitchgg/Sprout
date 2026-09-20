-- Apply after 20260923_farm_presence_repair.sql. Movement Broadcast is visual-only.
-- The same room authorization used for Presence gates both read and send.
begin;
drop policy if exists sprout_farm_movement_read on realtime.messages;
drop policy if exists sprout_farm_movement_write on realtime.messages;
create policy sprout_farm_movement_read on realtime.messages
for select to authenticated using (
  extension = 'broadcast'
  and public.can_join_sprout_farm(realtime.topic(),
    current_setting('request.jwt.claims', true)::jsonb ->> 'discord_user_id')
);
create policy sprout_farm_movement_write on realtime.messages
for insert to authenticated with check (
  extension = 'broadcast'
  and public.can_join_sprout_farm(realtime.topic(),
    current_setting('request.jwt.claims', true)::jsonb ->> 'discord_user_id')
);
commit;
