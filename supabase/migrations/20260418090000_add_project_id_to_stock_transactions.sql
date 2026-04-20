alter table public.stock_transactions
  add column if not exists project_id uuid references public.projects(id) on delete set null;

update public.stock_transactions st
set project_id = e.project_id
from public.expenses e
where e.id = st.expense_id
  and st.project_id is null;

alter table public.stock_transactions
  alter column project_id set not null;

create index if not exists idx_stock_transactions_project_date
  on public.stock_transactions(project_id, transaction_date);
