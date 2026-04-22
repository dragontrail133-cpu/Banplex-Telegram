create table if not exists public.telegram_assistant_sessions (
  chat_id text primary key,
  telegram_user_id text not null,
  team_id uuid references public.teams(id) on delete cascade,
  state text not null default 'idle',
  pending_intent text,
  pending_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_assistant_sessions_state_check
    check (state in ('idle', 'awaiting_workspace_choice', 'awaiting_clarification'))
);

create index if not exists idx_telegram_assistant_sessions_telegram_user_id
  on public.telegram_assistant_sessions (telegram_user_id);

create index if not exists idx_telegram_assistant_sessions_team_id
  on public.telegram_assistant_sessions (team_id);

create index if not exists idx_telegram_assistant_sessions_expires_at
  on public.telegram_assistant_sessions (expires_at);

alter table public.telegram_assistant_sessions enable row level security;
