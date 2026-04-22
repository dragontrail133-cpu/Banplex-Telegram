drop index if exists public.bills_project_income_staff_key;

create unique index if not exists bills_project_income_staff_key
  on public.bills (project_income_id, staff_id);
