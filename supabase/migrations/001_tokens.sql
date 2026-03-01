create table if not exists tokens (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  provider text not null check (provider in ('github', 'linear')),
  encrypted_token text not null,
  iv text not null,
  auth_tag text not null,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tokens_device_provider_unique unique (device_id, provider)
);

create index if not exists idx_tokens_device_id on tokens (device_id);
