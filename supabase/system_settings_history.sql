-- History table for system settings changes.
create table if not exists system_settings_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  scope_type text not null default 'GLOBAL',
  scope_id uuid null,
  old_value_type text not null,
  old_value_number numeric null,
  old_value_bool boolean null,
  old_value_text text null,
  old_value_json jsonb null,
  new_value_type text not null,
  new_value_number numeric null,
  new_value_bool boolean null,
  new_value_text text null,
  new_value_json jsonb null,
  reason text null,
  source text not null default 'ui',
  actor_label text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_settings_history_key_created on system_settings_history(setting_key, created_at desc);
create index if not exists idx_system_settings_history_scope_created on system_settings_history(scope_type, scope_id, created_at desc);
