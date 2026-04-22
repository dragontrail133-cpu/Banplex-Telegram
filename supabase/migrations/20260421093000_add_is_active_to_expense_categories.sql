begin;

alter table public.expense_categories
  add column if not exists is_active boolean;

update public.expense_categories
set is_active = coalesce(is_active, true);

alter table public.expense_categories
  alter column is_active set default true;

alter table public.expense_categories
  alter column is_active set not null;

commit;
