begin;

create or replace function public.manufacturing_create_template_version(
  p_template_id uuid,
  p_notes text default null
)
returns table (template_version_id uuid, version_number int)
language plpgsql
as $$
declare
  v_template public.manufacturing_templates%rowtype;
  v_version_number int;
  v_material_spec jsonb;
begin
  select *
    into v_template
    from public.manufacturing_templates
   where id = p_template_id
     and tenant_id = public.current_tenant_id()
   for update;

  if not found then
    raise exception 'template not found';
  end if;

  if v_template.draft_json is null then
    raise exception 'draft_json is required';
  end if;

  v_material_spec := v_template.draft_json->'materialSpec';
  if v_material_spec is null then
    raise exception 'materialSpec is required';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_version_number
    from public.manufacturing_template_versions
   where template_id = p_template_id;

  update public.manufacturing_template_versions
     set is_current = false
   where template_id = p_template_id
     and is_current = true;

  insert into public.manufacturing_template_versions (
    tenant_id,
    template_id,
    version_number,
    is_current,
    material_spec_json,
    cost_model_json
  ) values (
    v_template.tenant_id,
    p_template_id,
    v_version_number,
    true,
    v_material_spec,
    jsonb_build_object('rate_source', 'stubbed_default_v1', 'notes', p_notes)
  )
  returning id into template_version_id;

  insert into public.manufacturing_template_operations (
    tenant_id,
    template_version_id,
    operation_type,
    estimated_hours,
    skill_type,
    machine_type,
    operation_params_json,
    sort_order
  )
  select
    v_template.tenant_id,
    template_version_id,
    (op->>'name')::text,
    coalesce(nullif(op->>'estimated_hours', '')::numeric, 0),
    coalesce(nullif(op->>'skill_type', ''), 'general'),
    nullif(op->>'machine_type', ''),
    '{}'::jsonb,
    ord
  from jsonb_array_elements(coalesce(v_template.draft_json->'operations', '[]'::jsonb)) with ordinality as op(op, ord);

  insert into public.manufacturing_material_groups (
    tenant_id,
    template_version_id,
    name,
    spec,
    estimated_quantity,
    unit,
    scrap_factor_percent,
    notes
  )
  select
    v_template.tenant_id,
    template_version_id,
    nullif(mg->>'name', ''),
    nullif(mg->>'spec', ''),
    nullif(mg->>'estimated_quantity', '')::numeric,
    nullif(mg->>'unit', ''),
    nullif(mg->>'scrap_factor_percent', '')::numeric,
    nullif(mg->>'notes', '')
  from jsonb_array_elements(coalesce(v_template.draft_json->'materialGroups', '[]'::jsonb)) as mg;

  update public.manufacturing_templates
     set draft_json = null
   where id = p_template_id
     and tenant_id = v_template.tenant_id;

  return query select template_version_id, v_version_number;
end;
$$;

grant execute on function public.manufacturing_create_template_version(uuid, text) to authenticated;

commit;
