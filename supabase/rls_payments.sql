-- RLS: payments (Phase 2)
-- Role source: public.profiles.role (id = auth.uid()).

-- 1) Helper function
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text from public.profiles where id = auth.uid()),
    'TECH'
  );
$$;

-- 2) Enable + force RLS on payments
alter table public.payments enable row level security;
alter table public.payments force row level security;

-- 3) Policies: aligned to your current "payments.record" set
drop policy if exists "payments_select_record_roles" on public.payments;
create policy "payments_select_record_roles"
on public.payments
for select
to authenticated
using (public.current_app_role() in ('ADMIN','MANAGER','SERVICE_WRITER'));

drop policy if exists "payments_insert_record_roles" on public.payments;
create policy "payments_insert_record_roles"
on public.payments
for insert
to authenticated
with check (public.current_app_role() in ('ADMIN','MANAGER','SERVICE_WRITER'));

-- UPDATE = "void transition only" (row must go from unvoided -> voided)
drop policy if exists "payments_update_void_transition_only" on public.payments;
create policy "payments_update_void_transition_only"
on public.payments
for update
to authenticated
using (
  public.current_app_role() in ('ADMIN','MANAGER','SERVICE_WRITER')
  and voided_at is null
)
with check (
  public.current_app_role() in ('ADMIN','MANAGER','SERVICE_WRITER')
  and voided_at is not null
);

-- No DELETE policy => delete denied by default under RLS
