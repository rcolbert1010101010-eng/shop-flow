begin;

-- =========================
-- Manufacturing Rebuild v1 (fabrication-first)
-- Templates + versioning + operations + material groups + jobs
-- No inventory side effects
-- =========================

create table if not exists public.manufacturing_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),

  name text not null,
  description text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

create index if not exists manufacturing_templates_tenant_id_idx
  on public.manufacturing_templates (tenant_id);

create unique index if not exists manufacturing_templates_tenant_name_ux
  on public.manufacturing_templates (tenant_id, name);

alter table public.manufacturing_templates enable row level security;

drop policy if exists mt_select on public.manufacturing_templates;
create policy mt_select
  on public.manufacturing_templates
  for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists mt_write on public.manufacturing_templates;
drop policy if exists mt_insert on public.manufacturing_templates;
drop policy if exists mt_update on public.manufacturing_templates;
create policy mt_insert
  on public.manufacturing_templates
  for insert
  with check (tenant_id = public.current_tenant_id());
create policy mt_update
  on public.manufacturing_templates
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =========================

create table if not exists public.manufacturing_template_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),

  template_id uuid not null references public.manufacturing_templates(id) on delete cascade,
  version_number int not null,
  is_current boolean not null default false,

  material_spec_json jsonb not null,
  cost_model_json jsonb not null,

  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

create unique index if not exists mtv_one_current_ux
  on public.manufacturing_template_versions (template_id)
  where is_current = true;

create unique index if not exists mtv_version_unique_ux
  on public.manufacturing_template_versions (template_id, version_number);

create index if not exists manufacturing_template_versions_tenant_id_idx
  on public.manufacturing_template_versions (tenant_id);

alter table public.manufacturing_template_versions enable row level security;

drop policy if exists mtv_select on public.manufacturing_template_versions;
create policy mtv_select
  on public.manufacturing_template_versions
  for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists mtv_write on public.manufacturing_template_versions;
drop policy if exists mtv_insert on public.manufacturing_template_versions;
drop policy if exists mtv_update on public.manufacturing_template_versions;
create policy mtv_insert
  on public.manufacturing_template_versions
  for insert
  with check (tenant_id = public.current_tenant_id());
create policy mtv_update
  on public.manufacturing_template_versions
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =========================
-- Template operations (fabrication steps)
-- =========================

create table if not exists public.manufacturing_template_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),

  template_version_id uuid not null
    references public.manufacturing_template_versions(id) on delete cascade,

  operation_type text not null, -- weld | plasma_cut | brake_form | fit_up | paint
  estimated_hours numeric not null default 0,
  skill_type text not null default 'general', -- welder | fitter | painter | general
  machine_type text, -- plasma | brake (optional)

  operation_params_json jsonb not null default '{}'::jsonb,

  sort_order int not null default 0
);

create index if not exists manufacturing_template_operations_tenant_id_idx
  on public.manufacturing_template_operations (tenant_id);

create index if not exists manufacturing_template_operations_version_id_idx
  on public.manufacturing_template_operations (template_version_id);

alter table public.manufacturing_template_operations enable row level security;

drop policy if exists mto_select on public.manufacturing_template_operations;
create policy mto_select
  on public.manufacturing_template_operations
  for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists mto_write on public.manufacturing_template_operations;
drop policy if exists mto_insert on public.manufacturing_template_operations;
drop policy if exists mto_update on public.manufacturing_template_operations;
create policy mto_insert
  on public.manufacturing_template_operations
  for insert
  with check (tenant_id = public.current_tenant_id());
create policy mto_update
  on public.manufacturing_template_operations
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =========================
-- Material groups (design intent only)
-- =========================

create table if not exists public.manufacturing_material_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),

  template_version_id uuid not null
    references public.manufacturing_template_versions(id) on delete cascade,

  name text not null,
  spec text not null,
  estimated_quantity numeric,
  unit text,
  scrap_factor_percent numeric,
  notes text
);

create index if not exists manufacturing_material_groups_tenant_id_idx
  on public.manufacturing_material_groups (tenant_id);

create index if not exists manufacturing_material_groups_version_id_idx
  on public.manufacturing_material_groups (template_version_id);

alter table public.manufacturing_material_groups enable row level security;

drop policy if exists mmg_select on public.manufacturing_material_groups;
create policy mmg_select
  on public.manufacturing_material_groups
  for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists mmg_write on public.manufacturing_material_groups;
drop policy if exists mmg_insert on public.manufacturing_material_groups;
drop policy if exists mmg_update on public.manufacturing_material_groups;
create policy mmg_insert
  on public.manufacturing_material_groups
  for insert
  with check (tenant_id = public.current_tenant_id());
create policy mmg_update
  on public.manufacturing_material_groups
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =========================
-- Jobs (snapshot of a template version)
-- =========================

create table if not exists public.manufacturing_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),

  source_template_version_id uuid
    references public.manufacturing_template_versions(id),

  job_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'completed', 'canceled')),

  calculated_cost numeric(12,2) not null,
  cost_breakdown_json jsonb not null,

  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

create index if not exists manufacturing_jobs_tenant_id_idx
  on public.manufacturing_jobs (tenant_id);

create index if not exists manufacturing_jobs_status_idx
  on public.manufacturing_jobs (status);

alter table public.manufacturing_jobs enable row level security;

drop policy if exists mj_select on public.manufacturing_jobs;
create policy mj_select
  on public.manufacturing_jobs
  for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists mj_write on public.manufacturing_jobs;
drop policy if exists mj_insert on public.manufacturing_jobs;
drop policy if exists mj_update on public.manufacturing_jobs;
create policy mj_insert
  on public.manufacturing_jobs
  for insert
  with check (tenant_id = public.current_tenant_id());
create policy mj_update
  on public.manufacturing_jobs
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =========================
-- Job operations (frozen costs)
-- =========================

create table if not exists public.manufacturing_job_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),

  manufacturing_job_id uuid not null
    references public.manufacturing_jobs(id) on delete cascade,

  operation_type text not null,
  operation_params_json jsonb not null default '{}'::jsonb,

  derived_cost numeric(12,2) not null,
  labor_cost numeric(12,2) not null default 0,
  machine_cost numeric(12,2) not null default 0,
  actual_hours numeric
);

create index if not exists manufacturing_job_operations_tenant_id_idx
  on public.manufacturing_job_operations (tenant_id);

create index if not exists manufacturing_job_operations_job_id_idx
  on public.manufacturing_job_operations (manufacturing_job_id);

alter table public.manufacturing_job_operations enable row level security;

drop policy if exists mjo_select on public.manufacturing_job_operations;
create policy mjo_select
  on public.manufacturing_job_operations
  for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists mjo_write on public.manufacturing_job_operations;
drop policy if exists mjo_insert on public.manufacturing_job_operations;
drop policy if exists mjo_update on public.manufacturing_job_operations;
create policy mjo_insert
  on public.manufacturing_job_operations
  for insert
  with check (tenant_id = public.current_tenant_id());
create policy mjo_update
  on public.manufacturing_job_operations
  for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

commit;
