-- System Settings base table. Apply this in Supabase (or your DB) before enabling System Settings v1.
create table if not exists system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  scope_type text not null default 'GLOBAL',
  scope_id uuid null,
  value_type text not null,
  value_number numeric null,
  value_bool boolean null,
  value_text text null,
  value_json jsonb null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, scope_type, scope_id)
);

create index if not exists idx_system_settings_key_scope on system_settings(key, scope_type, scope_id);
