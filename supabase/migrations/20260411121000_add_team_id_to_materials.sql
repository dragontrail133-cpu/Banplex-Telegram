alter table public.materials
  add column if not exists team_id uuid;

grant select, insert, update on table public.materials to anon, authenticated;
