create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on sessions (user_id);
create index if not exists idx_sessions_expires_at on sessions (expires_at);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  github_repo text,
  personas_json jsonb not null default '[]'::jsonb,
  selected_persona_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  prompt text not null,
  vibe text,
  subject text,
  preheader text,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_history_user_id_created_at
  on chat_history (user_id, created_at desc);

alter table if exists tokens
  add column if not exists user_id uuid references users(id) on delete cascade;

alter table if exists tokens
  alter column device_id drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tokens_provider_check'
      and conrelid = 'tokens'::regclass
  ) then
    alter table tokens drop constraint tokens_provider_check;
  end if;
end $$;

alter table if exists tokens
  add constraint tokens_provider_check check (provider in ('github', 'linear', 'loops'));

drop index if exists idx_tokens_device_id;
create index if not exists idx_tokens_user_id on tokens (user_id);

alter table if exists tokens
  drop constraint if exists tokens_device_provider_unique;

alter table if exists tokens
  add constraint tokens_user_provider_unique unique (user_id, provider);
