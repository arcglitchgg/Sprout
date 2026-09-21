-- Apply after 20260921_social.sql so defense snapshots can contain fused Ascended fighters.
begin;
alter table public.defense_fighters drop constraint if exists defense_fighters_mutation_check;
alter table public.defense_fighters add constraint defense_fighters_mutation_check
  check (mutation in ('normal', 'large', 'golden', 'prismatic', 'ascended'));
commit;
