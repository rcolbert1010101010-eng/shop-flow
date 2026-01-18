-- Apply order bundle: Roles & Users foundation -> Payments RLS -> System Settings RLS
-- Safe for Supabase SQL Editor: functions first, then policies, then RLS enable/force.

-- ============================================================
-- SECTION 1: Roles & Users foundation (tables, seeds, helpers, RLS)
-- Source: supabase/roles_and_users.sql
-- ============================================================

-- Roles & Users Admin foundation
-- Creates roles, user_profiles, user_roles with RLS and helper functions.

-- Ensure UUID generation is available
create extension if not exists "pgcrypto";

-- 1) Tables
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id),
  created_at timestamptz default now(),
  unique (user_id)
);

-- 2) Seed default roles (idempotent)
insert into public.roles (key, name, description, is_active)
values
  ('admin', 'Admin', 'Full administrator access', true),
  ('manager', 'Manager', 'Manager access', true),
  ('service_writer', 'Service Writer', 'Service writer access', true),
  ('technician', 'Technician', 'Technician access', true),
  ('parts_manager', 'Parts Manager', 'Parts & inventory access', true),
  ('sales_counter', 'Sales Counter', 'Front counter sales access', true),
  ('guest', 'Guest', 'Limited guest access', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

-- 3) Helpers
-- current_app_role now prefers user_roles/roles and falls back to legacy profiles.role
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select lower(r.key)
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
      limit 1
    ),
    (select lower(role)::text from public.profiles where id = auth.uid()),
    'technician'
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = uid
      and r.key = 'admin'
      and r.is_active = true
  );
$$;

-- 4) RLS policies
-- roles
drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "roles_write_admin_only" on public.roles;
create policy "roles_write_admin_only"
on public.roles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
alter table public.roles enable row level security;
alter table public.roles force row level security;

-- user_profiles
drop policy if exists "user_profiles_select_admin" on public.user_profiles;
create policy "user_profiles_select_admin"
on public.user_profiles
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "user_profiles_select_self" on public.user_profiles;
create policy "user_profiles_select_self"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "user_profiles_write_admin_only" on public.user_profiles;
create policy "user_profiles_write_admin_only"
on public.user_profiles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;

-- user_roles
drop policy if exists "user_roles_select_admin" on public.user_roles;
create policy "user_roles_select_admin"
on public.user_roles
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_roles_write_admin_only" on public.user_roles;
create policy "user_roles_write_admin_only"
on public.user_roles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

-- ============================================================
-- SECTION 2: Payments RLS (reassert with user_roles-aware helper)
-- Source: supabase/rls_payments.sql
-- ============================================================

-- RLS: payments (Phase 2)
-- Role source: public.user_roles -> roles.key (fallback to public.profiles.role).

-- 2) Enable + force RLS on payments
alter table public.payments enable row level security;
alter table public.payments force row level security;

-- 3) Policies: aligned to your current "payments.record" set
drop policy if exists "payments_select_record_roles" on public.payments;
create policy "payments_select_record_roles"
on public.payments
for select
to authenticated
using (public.current_app_role() in ('admin','manager','service_writer'));

drop policy if exists "payments_insert_record_roles" on public.payments;
create policy "payments_insert_record_roles"
on public.payments
for insert
to authenticated
with check (public.current_app_role() in ('admin','manager','service_writer'));

-- UPDATE = "void transition only" (row must go from unvoided -> voided)
drop policy if exists "payments_update_void_transition_only" on public.payments;
create policy "payments_update_void_transition_only"
on public.payments
for update
to authenticated
using (
  public.current_app_role() in ('admin','manager','service_writer')
  and voided_at is null
)
with check (
  public.current_app_role() in ('admin','manager','service_writer')
  and voided_at is not null
);

-- No DELETE policy => delete denied by default under RLS

-- ============================================================
-- SECTION 3: System Settings RLS (user_roles-aware helper)
-- Source: supabase/rls_system_settings.sql
-- ============================================================

-- RLS: system_settings
-- Role source: public.user_roles -> roles.key (fallback to public.profiles.role).

-- Policies
drop policy if exists "system_settings_select_all_authenticated" on public.system_settings;
create policy "system_settings_select_all_authenticated"
on public.system_settings
for select
to authenticated
using (true);

drop policy if exists "system_settings_insert_admin_only" on public.system_settings;
create policy "system_settings_insert_admin_only"
on public.system_settings
for insert
to authenticated
with check (public.current_app_role() in ('admin'));

drop policy if exists "system_settings_update_admin_only" on public.system_settings;
create policy "system_settings_update_admin_only"
on public.system_settings
for update
to authenticated
using (public.current_app_role() in ('admin'))
with check (public.current_app_role() in ('admin'));

-- Enable + force RLS (run after policies to avoid lockouts)
alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;
