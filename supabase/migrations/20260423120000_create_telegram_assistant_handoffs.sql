create table if not exists public.telegram_assistant_handoffs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  source_chat_id text not null,
  source_message_id text,
  telegram_user_id text not null,
  team_id uuid references public.teams(id) on delete cascade,
  session_payload jsonb not null default '{}'::jsonb,
  original_text text not null default '',
  language text not null default 'id',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_chat_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_assistant_handoffs_language_check
    check (language in ('id', 'su'))
);

create index if not exists idx_telegram_assistant_handoffs_telegram_user_id
  on public.telegram_assistant_handoffs (telegram_user_id);

create index if not exists idx_telegram_assistant_handoffs_expires_at
  on public.telegram_assistant_handoffs (expires_at);

alter table public.telegram_assistant_handoffs enable row level security;

drop trigger if exists trg_telegram_assistant_handoffs_set_current_timestamp on public.telegram_assistant_handoffs;
create trigger trg_telegram_assistant_handoffs_set_current_timestamp
before update on public.telegram_assistant_handoffs
for each row
execute function app_private.set_current_timestamp();
