begin;

alter table public.expense_line_items
  add column if not exists team_id uuid;

alter table public.expense_attachments
  add column if not exists team_id uuid;

update public.expense_line_items eli
set team_id = e.team_id
from public.expenses e
where e.id = eli.expense_id
  and eli.team_id is distinct from e.team_id;

update public.expense_attachments ea
set team_id = e.team_id
from public.expenses e
where e.id = ea.expense_id
  and ea.team_id is distinct from e.team_id;

alter table public.expense_line_items
  alter column team_id set not null;

alter table public.expense_attachments
  alter column team_id set not null;

alter table public.expense_line_items
  drop constraint if exists expense_line_items_team_id_fkey;

alter table public.expense_line_items
  add constraint expense_line_items_team_id_fkey
  foreign key (team_id) references public.teams(id);

alter table public.expense_attachments
  drop constraint if exists expense_attachments_team_id_fkey;

alter table public.expense_attachments
  add constraint expense_attachments_team_id_fkey
  foreign key (team_id) references public.teams(id);

create index if not exists idx_expense_line_items_team_id_expense_sort
  on public.expense_line_items(team_id, expense_id, sort_order);

create index if not exists idx_expense_line_items_team_id_deleted_at
  on public.expense_line_items(team_id, deleted_at);

create index if not exists idx_expense_attachments_team_id_expense_sort
  on public.expense_attachments(team_id, expense_id, sort_order);

create index if not exists idx_expense_attachments_team_id_deleted_at
  on public.expense_attachments(team_id, deleted_at);

create or replace function public.sync_expense_child_team_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_team_id uuid;
begin
  select e.team_id
    into parent_team_id
  from public.expenses e
  where e.id = new.expense_id;

  if parent_team_id is null then
    raise exception 'Parent expense team_id tidak ditemukan.';
  end if;

  new.team_id := parent_team_id;
  return new;
end;
$$;

revoke all on function public.sync_expense_child_team_id() from public, anon, authenticated;

drop trigger if exists trg_sync_expense_line_item_team_id on public.expense_line_items;
create trigger trg_sync_expense_line_item_team_id
before insert or update of expense_id, team_id on public.expense_line_items
for each row
execute function public.sync_expense_child_team_id();

drop trigger if exists trg_sync_expense_attachment_team_id on public.expense_attachments;
create trigger trg_sync_expense_attachment_team_id
before insert or update of expense_id, team_id on public.expense_attachments
for each row
execute function public.sync_expense_child_team_id();

create or replace function public.propagate_expense_team_id_to_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.expense_line_items
  set team_id = new.team_id,
      updated_at = now()
  where expense_id = new.id;

  update public.expense_attachments
  set team_id = new.team_id,
      updated_at = now()
  where expense_id = new.id;

  return new;
end;
$$;

revoke all on function public.propagate_expense_team_id_to_children() from public, anon, authenticated;

drop trigger if exists trg_propagate_expense_team_id_to_children on public.expenses;
create trigger trg_propagate_expense_team_id_to_children
after update of team_id on public.expenses
for each row
execute function public.propagate_expense_team_id_to_children();

drop policy if exists expense_line_items_select_team on public.expense_line_items;
create policy expense_line_items_select_team
on public.expense_line_items
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists expense_line_items_insert_team on public.expense_line_items;
create policy expense_line_items_insert_team
on public.expense_line_items
for insert
to authenticated
with check (
  app_private.can_access_team(team_id)
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and e.team_id = expense_line_items.team_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_line_items_update_team on public.expense_line_items;
create policy expense_line_items_update_team
on public.expense_line_items
for update
to authenticated
using (
  app_private.can_access_team(team_id)
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and e.team_id = expense_line_items.team_id
      and app_private.can_access_team(e.team_id)
  )
)
with check (
  app_private.can_access_team(team_id)
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_line_items.expense_id
      and e.team_id = expense_line_items.team_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_attachments_select_team on public.expense_attachments;
create policy expense_attachments_select_team
on public.expense_attachments
for select
to authenticated
using (app_private.can_access_team(team_id));

drop policy if exists expense_attachments_insert_team on public.expense_attachments;
create policy expense_attachments_insert_team
on public.expense_attachments
for insert
to authenticated
with check (
  app_private.can_access_team(team_id)
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and e.team_id = expense_attachments.team_id
      and app_private.can_access_team(e.team_id)
  )
);

drop policy if exists expense_attachments_update_team on public.expense_attachments;
create policy expense_attachments_update_team
on public.expense_attachments
for update
to authenticated
using (
  app_private.can_access_team(team_id)
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and e.team_id = expense_attachments.team_id
      and app_private.can_access_team(e.team_id)
  )
)
with check (
  app_private.can_access_team(team_id)
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_attachments.expense_id
      and e.team_id = expense_attachments.team_id
      and app_private.can_access_team(e.team_id)
  )
);

commit;
