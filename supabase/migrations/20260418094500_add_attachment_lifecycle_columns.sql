alter table public.expense_attachments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create index if not exists idx_expense_attachments_expense_deleted_at
  on public.expense_attachments(expense_id, deleted_at);

create index if not exists idx_expense_attachments_file_asset_id
  on public.expense_attachments(file_asset_id);
