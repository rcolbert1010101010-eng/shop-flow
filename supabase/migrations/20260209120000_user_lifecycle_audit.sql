begin;

alter table public.tenant_users
  add column if not exists deactivated_at timestamptz null;

create index if not exists tenant_users_tenant_deactivated_at_idx
  on public.tenant_users (tenant_id, deactivated_at);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_created_idx
  on public.audit_log (tenant_id, created_at desc);

create index if not exists audit_log_tenant_entity_idx
  on public.audit_log (tenant_id, entity_type, entity_id);

commit;
