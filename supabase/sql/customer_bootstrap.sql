--
-- PostgreSQL database dump
--

\restrict zhowYHacbLzPou3WPKquNbThmfBxTkc0WZX2NGOCbjhQ0Iwced2q2bwCsuKO4Jp

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: inventory_movement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inventory_movement_type AS ENUM (
    'PO_RECEIPT',
    'SO_ISSUE',
    'WO_ISSUE',
    'SO_RETURN',
    'WO_RETURN',
    'ADJUST'
);


--
-- Name: purchase_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_order_status AS ENUM (
    'OPEN',
    'CLOSED'
);


--
-- Name: sales_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_order_status AS ENUM (
    'OPEN',
    'INVOICED'
);


--
-- Name: work_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_order_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'INVOICED'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select role::text from public.profiles where id = auth.uid()),
    'TECH'
  );
$$;


--
-- Name: assert_not_invoiced_so(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_not_invoiced_so(p_sales_order_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare v_status sales_order_status;
begin
  select status into v_status from sales_orders where id = p_sales_order_id;
  if v_status is null then raise exception 'Sales order not found'; end if;
  if v_status = 'INVOICED' then raise exception 'Sales order is invoiced and locked'; end if;
end $$;


--
-- Name: assert_not_invoiced_wo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_not_invoiced_wo(p_work_order_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare v_status work_order_status;
begin
  select status into v_status from work_orders where id = p_work_order_id;
  if v_status is null then raise exception 'Work order not found'; end if;
  if v_status = 'INVOICED' then raise exception 'Work order is invoiced and locked'; end if;
end $$;


--
-- Name: claim_accounting_exports(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_accounting_exports(p_provider text, p_limit integer) RETURNS SETOF uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if to_regclass('public.accounting_exports') is null then
    return;
  end if;

  return query
  with c as (
    select ae.id
    from public.accounting_exports ae
    where ae.tenant_id = public.current_tenant_id()
      and ae.provider = p_provider
      and ae.status = 'PENDING'
      and (ae.next_attempt_at is null or ae.next_attempt_at <= now())
    order by ae.created_at asc
    for update skip locked
    limit greatest(p_limit, 0)
  )
  update public.accounting_exports ae
  set
    status = 'PROCESSING',
    attempt_count = ae.attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  from c
  where ae.id = c.id
  returning ae.id;
end;
$$;


--
-- Name: current_app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_role() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_role text;
  v_profiles_role text;
begin
  -- Prefer new role mapping
  select lower(r.key)
    into v_role
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.user_id = auth.uid()
   limit 1;

  if v_role is not null then
    return v_role;
  end if;

  -- Optional legacy fallback (only if public.profiles exists)
  if to_regclass('public.profiles') is not null then
    execute 'select lower(role::text) from public.profiles where id = auth.uid()'
      into v_profiles_role;

    if v_profiles_role is not null then
      return v_profiles_role;
    end if;
  end if;

  return 'technician';
end;
$$;


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select coalesce(
    (
      select p.active_tenant_id
      from public.profiles p
      join public.tenant_users tu on tu.tenant_id = p.active_tenant_id
      where p.id = auth.uid()
        and tu.user_id = auth.uid()
      limit 1
    ),
    (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = auth.uid()
      order by tu.created_at asc nulls last, tu.tenant_id asc
      limit 1
    )
  );
$$;


--
-- Name: enforce_payments_void_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_payments_void_only() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if old.voided_at is not null then
    raise exception 'Voided payments are immutable.';
  end if;

  if new.voided_at is null then
    raise exception 'Payments are immutable; only voiding is allowed.';
  end if;

  if new.amount           is distinct from old.amount
     or new.method        is distinct from old.method
     or new.reference     is distinct from old.reference
     or new.notes         is distinct from old.notes
     or new.order_type    is distinct from old.order_type
     or new.order_id      is distinct from old.order_id
     or new.created_at    is distinct from old.created_at
     or new.id            is distinct from old.id then
    raise exception 'Only voided_at and void_reason may change when voiding.';
  end if;

  return new;
end;
$$;


--
-- Name: invoice_sales_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoice_sales_order(p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_status text;
BEGIN
  -- Lock the sales order row so concurrent calls serialize
  SELECT status
  INTO v_status
  FROM sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order % not found', p_order_id;
  END IF;

  -- Idempotency: if already invoiced, do nothing but report it
  IF v_status = 'INVOICED' THEN
    RETURN json_build_object(
      'success', true,
      'already_invoiced', true
    );
  END IF;

  -- Decrement inventory using aggregated quantities per part
  -- (so multiple lines for the same part subtract correctly)
  UPDATE parts p
  SET quantity_on_hand = p.quantity_on_hand - line_totals.total_qty
  FROM (
    SELECT part_id, SUM(qty) AS total_qty
    FROM sales_order_lines
    WHERE sales_order_id = p_order_id
    GROUP BY part_id
  ) AS line_totals
  WHERE line_totals.part_id = p.id;

  -- Mark the order as invoiced
  UPDATE sales_orders
  SET status = 'INVOICED',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true,
    'already_invoiced', false
  );
END;
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = uid
       and r.key = 'admin'
       and r.is_active = true
  );
$$;


--
-- Name: is_current_tenant_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_tenant_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.user_id = auth.uid()
      and tu.tenant_id = public.current_tenant_id()
      and tu.role = 'admin'
  );
$$;


--
-- Name: manufacturing_create_template_version(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manufacturing_create_template_version(p_template_id uuid, p_notes text DEFAULT NULL::text) RETURNS TABLE(template_version_id uuid, version_number integer)
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: manufacturing_parts_picker(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manufacturing_parts_picker() RETURNS TABLE(id uuid, part_number text, description text, cost numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p.id,
    p.part_number,
    p.description,
    p.cost
  from public.parts p
  where coalesce(p.is_active, true) = true
  order by p.part_number asc;
$$;


--
-- Name: normalize_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_phone(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(regexp_replace(trim(coalesce(p,'')), '\s+', '', 'g'), '')
$$;


--
-- Name: parts_picker(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parts_picker(q text DEFAULT NULL::text, lim integer DEFAULT 50) RETURNS TABLE(id uuid, part_number text, description text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p.id,
    p.part_number,
    p.description
  from public.parts p
  where
    -- optional search
    (q is null or q = '' or
      p.part_number ilike ('%' || q || '%') or
      p.description ilike ('%' || q || '%')
    )
  order by p.part_number asc nulls last
  limit greatest(1, least(lim, 200));
$$;


--
-- Name: parts_resolve_ids(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parts_resolve_ids(part_numbers text[]) RETURNS TABLE(part_number text, id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.part_number, p.id
  from public.parts p
  where p.part_number = any(part_numbers);
$$;


--
-- Name: po_receive(uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.po_receive(p_purchase_order_id uuid, p_lines jsonb, p_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_event_id uuid;
  v_line jsonb;
  v_pol_id uuid;
  v_qty int;
  v_cost numeric(12,2);
  v_part_id uuid;
  v_remaining int;
begin
  -- Create receiving event
  insert into receiving_events (purchase_order_id, notes)
  values (p_purchase_order_id, p_notes)
  returning id into v_event_id;

  -- Apply each received line
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_pol_id := (v_line->>'purchase_order_line_id')::uuid;
    v_qty := (v_line->>'qty_received')::int;
    v_cost := coalesce((v_line->>'unit_cost')::numeric, 0);

    if v_qty <= 0 then raise exception 'qty_received must be > 0'; end if;

    select pol.part_id, (pol.qty_ordered - pol.qty_received)
      into v_part_id, v_remaining
    from purchase_order_lines pol
    where pol.id = v_pol_id and pol.purchase_order_id = p_purchase_order_id;

    if v_part_id is null then raise exception 'PO line not found'; end if;
    if v_qty > v_remaining then raise exception 'Receiving exceeds remaining qty'; end if;

    -- Record receiving detail
    insert into receiving_event_lines (receiving_event_id, purchase_order_line_id, qty_received, unit_cost)
    values (v_event_id, v_pol_id, v_qty, v_cost);

    -- Update PO line received qty
    update purchase_order_lines
    set qty_received = qty_received + v_qty,
        unit_cost_snapshot = v_cost,
        updated_at = now()
    where id = v_pol_id;

    -- Update inventory + last cost
    update parts
    set quantity_on_hand = quantity_on_hand + v_qty,
        cost = v_cost,
        updated_at = now()
    where id = v_part_id;

    insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
    values ('PO_RECEIPT', v_part_id, v_qty, 'purchase_orders', p_purchase_order_id, 'PO receipt');
  end loop;

  -- Auto-close PO if fully received
  if exists (
    select 1 from purchase_order_lines
    where purchase_order_id = p_purchase_order_id and qty_received < qty_ordered
  ) then
    -- still open
    update purchase_orders set status='OPEN', updated_at=now()
    where id = p_purchase_order_id;
  else
    update purchase_orders set status='CLOSED', closed_at=now(), updated_at=now()
    where id = p_purchase_order_id;
  end if;
end $$;


--
-- Name: queue_accounting_export_v1(text, text, text, uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_accounting_export_v1(provider text, export_type text, source_entity_type text, source_entity_id uuid, payload_json jsonb, payload_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  cfg record;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select *
  into cfg
  from public.accounting_integration_config
  where provider = queue_accounting_export_v1.provider
    and tenant_id = public.current_tenant_id()
  limit 1;

  if cfg is null or cfg.is_enabled is not true then
    return jsonb_build_object('status', 'skipped');
  end if;

  if coalesce(cfg.export_trigger, '') not like '%ON_INVOICE_FINALIZED%' then
    return jsonb_build_object('status', 'skipped');
  end if;

  if cfg.mode is not null and cfg.mode not in ('INVOICE_ONLY','INVOICE_AND_PAYMENTS','EXPORT_ONLY') then
    return jsonb_build_object('status', 'skipped', 'reason', 'mode_disabled');
  end if;

  begin
    insert into public.accounting_exports (
      tenant_id,
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status,
      attempt_count
    ) values (
      public.current_tenant_id(),
      queue_accounting_export_v1.provider,
      queue_accounting_export_v1.export_type,
      queue_accounting_export_v1.source_entity_type,
      queue_accounting_export_v1.source_entity_id,
      queue_accounting_export_v1.payload_json,
      queue_accounting_export_v1.payload_hash,
      'PENDING',
      0
    );
  exception
    when unique_violation then
      return jsonb_build_object('status', 'duplicate');
    when others then
      return jsonb_build_object('status', 'failed', 'error', SQLERRM);
  end;

  return jsonb_build_object('status', 'queued');
end;
$$;


--
-- Name: queue_invoice_export(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_invoice_export(invoice_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  cfg record;
  inv record;
  payload jsonb;
  payload_hash text;
  status_text text := 'queued';
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;

  select *
  into cfg
  from public.accounting_integration_config
  where provider = 'quickbooks'
    and tenant_id = public.current_tenant_id()
  limit 1;

  if cfg is null or cfg.is_enabled is not true then
    return 'skipped';
  end if;

  if coalesce(cfg.export_trigger, '') not like '%ON_INVOICE_FINALIZED%' then
    return 'skipped';
  end if;

  select
    i.id,
    i.invoice_number,
    i.created_at,
    i.issued_at,
    i.invoice_date,
    i.customer_id,
    i.status,
    i.voided_at,
    i.subtotal_parts,
    i.subtotal_labor,
    i.subtotal_fees,
    i.tax_amount,
    i.total,
    c.company_name,
    c.name,
    c.full_name
  into inv
  from public.invoices i
  left join public.customers c on c.id = i.customer_id
  where i.id = invoice_id;

  if inv is null then
    raise exception 'Invoice not found';
  end if;
  if inv.status is distinct from 'ISSUED' or inv.voided_at is not null then
    return 'skipped';
  end if;

  payload := jsonb_build_object(
    'schema_version', 1,
    'provider', 'quickbooks'
  );

  payload_hash := encode(digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex');

  begin
    insert into public.accounting_exports (
      tenant_id,
      provider,
      export_type,
      source_entity_type,
      source_entity_id,
      payload_json,
      payload_hash,
      status
    ) values (
      public.current_tenant_id(),
      'quickbooks',
      'INVOICE',
      'invoice',
      invoice_id,
      payload,
      payload_hash,
      'PENDING'
    );
  exception
    when unique_violation then
      status_text := 'duplicate';
  end;

  return status_text;
end;
$$;


--
-- Name: set_active_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_active_tenant(p_tenant_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.tenant_users
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
  ) then
    raise exception 'not a member of tenant';
  end if;

  insert into public.profiles (id, active_tenant_id)
  values (auth.uid(), p_tenant_id)
  on conflict (id)
  do update set active_tenant_id = excluded.active_tenant_id;

  return p_tenant_id;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: so_add_part_line(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.so_add_part_line(p_sales_order_id uuid, p_part_id uuid, p_qty integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_price numeric(12,2);
  v_core_required boolean;
  v_core_charge numeric(12,2);
begin
  if p_qty <= 0 then raise exception 'Quantity must be > 0'; end if;
  perform assert_not_invoiced_so(p_sales_order_id);

  select sell_price, core_required, core_charge_amount
    into v_price, v_core_required, v_core_charge
  from parts
  where id = p_part_id and is_active = true;

  if v_price is null then raise exception 'Part not found or inactive'; end if;

  -- Merge if exists
  insert into sales_order_lines (sales_order_id, part_id, qty, unit_price_snapshot, line_total, core_required, core_charge_amount)
  values (p_sales_order_id, p_part_id, p_qty, v_price, round(v_price * p_qty, 2), v_core_required, v_core_charge)
  on conflict (sales_order_id, part_id)
  do update set
    qty = sales_order_lines.qty + excluded.qty,
    line_total = round(sales_order_lines.unit_price_snapshot * (sales_order_lines.qty + excluded.qty), 2),
    updated_at = now();

  -- Inventory decrement
  update parts set quantity_on_hand = quantity_on_hand - p_qty where id = p_part_id;

  insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
  values ('SO_ISSUE', p_part_id, -p_qty, 'sales_orders', p_sales_order_id, 'SO add/merge line');
end $$;


--
-- Name: so_invoice(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.so_invoice(p_sales_order_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  perform assert_not_invoiced_so(p_sales_order_id);
  update sales_orders set status='INVOICED', invoiced_at=now(), updated_at=now()
  where id = p_sales_order_id;
end $$;


--
-- Name: so_remove_part_line(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.so_remove_part_line(p_line_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_qty integer;
  v_part_id uuid;
  v_so_id uuid;
begin
  select sales_order_id, part_id, qty into v_so_id, v_part_id, v_qty
  from sales_order_lines where id = p_line_id;

  if v_so_id is null then raise exception 'Line not found'; end if;
  perform assert_not_invoiced_so(v_so_id);

  delete from sales_order_lines where id = p_line_id;

  update parts set quantity_on_hand = quantity_on_hand + v_qty where id = v_part_id;

  insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
  values ('SO_RETURN', v_part_id, v_qty, 'sales_orders', v_so_id, 'SO remove line (restore)');
end $$;


--
-- Name: so_update_part_qty(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.so_update_part_qty(p_line_id uuid, p_new_qty integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_old_qty integer;
  v_delta integer;
  v_part_id uuid;
  v_so_id uuid;
  v_price numeric(12,2);
begin
  if p_new_qty <= 0 then raise exception 'Quantity must be > 0'; end if;

  select sales_order_id, part_id, qty, unit_price_snapshot
    into v_so_id, v_part_id, v_old_qty, v_price
  from sales_order_lines where id = p_line_id;

  if v_so_id is null then raise exception 'Line not found'; end if;
  perform assert_not_invoiced_so(v_so_id);

  v_delta := p_new_qty - v_old_qty; -- positive means more parts issued
  update sales_order_lines
    set qty = p_new_qty,
        line_total = round(v_price * p_new_qty, 2),
        updated_at = now()
  where id = p_line_id;

  if v_delta <> 0 then
    update parts set quantity_on_hand = quantity_on_hand - v_delta where id = v_part_id;
    insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
    values ('SO_ISSUE', v_part_id, -v_delta, 'sales_orders', v_so_id, 'SO qty change (delta)');
  end if;
end $$;


--
-- Name: tech_clock_in(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tech_clock_in(p_technician_id uuid, p_work_order_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_open_id uuid;
begin
  -- lock check
  perform assert_not_invoiced_wo(p_work_order_id);

  -- auto clock-off any open entry for this tech
  select id into v_open_id
  from technician_time_entries
  where technician_id = p_technician_id and clock_out is null
  limit 1;

  if v_open_id is not null then
    perform tech_clock_out(v_open_id);
  end if;

  insert into technician_time_entries (technician_id, work_order_id, clock_in)
  values (p_technician_id, p_work_order_id, now());
end $$;


--
-- Name: tech_clock_out(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tech_clock_out(p_time_entry_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_in timestamptz;
  v_out timestamptz := now();
  v_minutes integer;
begin
  select clock_in into v_in from technician_time_entries where id = p_time_entry_id;

  if v_in is null then raise exception 'Time entry not found'; end if;

  v_minutes := greatest(0, floor(extract(epoch from (v_out - v_in))/60));

  update technician_time_entries
  set clock_out = v_out,
      total_minutes = v_minutes,
      updated_at = now()
  where id = p_time_entry_id and clock_out is null;

  if not found then
    raise exception 'Time entry already closed';
  end if;
end $$;


--
-- Name: wo_add_labor_line(uuid, text, text, numeric, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wo_add_labor_line(p_work_order_id uuid, p_work_type text, p_technician_name text, p_hours numeric, p_is_warranty boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_rate numeric(12,2);
begin
  perform assert_not_invoiced_wo(p_work_order_id);

  select labor_rate_snapshot into v_rate from work_orders where id = p_work_order_id;
  if v_rate is null then raise exception 'Work order not found'; end if;

  insert into work_order_labor_lines (
    work_order_id, work_type, technician_name, hours, labor_rate_snapshot, line_total, is_warranty
  ) values (
    p_work_order_id, p_work_type, p_technician_name, p_hours, v_rate, round(v_rate * p_hours, 2), p_is_warranty
  );
end $$;


--
-- Name: wo_add_part_line(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wo_add_part_line(p_work_order_id uuid, p_part_id uuid, p_qty integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_price numeric(12,2);
  v_core_required boolean;
  v_core_charge numeric(12,2);
begin
  if p_qty <= 0 then raise exception 'Quantity must be > 0'; end if;
  perform assert_not_invoiced_wo(p_work_order_id);

  select sell_price, core_required, core_charge_amount
    into v_price, v_core_required, v_core_charge
  from parts where id = p_part_id and is_active = true;

  if v_price is null then raise exception 'Part not found or inactive'; end if;

  insert into work_order_part_lines (work_order_id, part_id, qty, unit_price_snapshot, line_total, core_required, core_charge_amount)
  values (p_work_order_id, p_part_id, p_qty, v_price, round(v_price * p_qty, 2), v_core_required, v_core_charge)
  on conflict (work_order_id, part_id)
  do update set
    qty = work_order_part_lines.qty + excluded.qty,
    line_total = round(work_order_part_lines.unit_price_snapshot * (work_order_part_lines.qty + excluded.qty), 2),
    updated_at = now();

  update parts set quantity_on_hand = quantity_on_hand - p_qty where id = p_part_id;

  insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
  values ('WO_ISSUE', p_part_id, -p_qty, 'work_orders', p_work_order_id, 'WO add/merge line');
end $$;


--
-- Name: wo_invoice(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wo_invoice(p_work_order_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  perform assert_not_invoiced_wo(p_work_order_id);
  update work_orders set status='INVOICED', invoiced_at=now(), updated_at=now()
  where id = p_work_order_id;
end $$;


--
-- Name: wo_remove_part_line(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wo_remove_part_line(p_line_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_qty integer;
  v_part_id uuid;
  v_wo_id uuid;
begin
  select work_order_id, part_id, qty into v_wo_id, v_part_id, v_qty
  from work_order_part_lines where id = p_line_id;

  if v_wo_id is null then raise exception 'Line not found'; end if;
  perform assert_not_invoiced_wo(v_wo_id);

  delete from work_order_part_lines where id = p_line_id;

  update parts set quantity_on_hand = quantity_on_hand + v_qty where id = v_part_id;

  insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
  values ('WO_RETURN', v_part_id, v_qty, 'work_orders', v_wo_id, 'WO remove line (restore)');
end $$;


--
-- Name: wo_update_part_qty(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.wo_update_part_qty(p_line_id uuid, p_new_qty integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_old_qty integer;
  v_delta integer;
  v_part_id uuid;
  v_wo_id uuid;
  v_price numeric(12,2);
begin
  if p_new_qty <= 0 then raise exception 'Quantity must be > 0'; end if;

  select work_order_id, part_id, qty, unit_price_snapshot
    into v_wo_id, v_part_id, v_old_qty, v_price
  from work_order_part_lines where id = p_line_id;

  if v_wo_id is null then raise exception 'Line not found'; end if;
  perform assert_not_invoiced_wo(v_wo_id);

  v_delta := p_new_qty - v_old_qty;
  update work_order_part_lines
    set qty = p_new_qty,
        line_total = round(v_price * p_new_qty, 2),
        updated_at = now()
  where id = p_line_id;

  if v_delta <> 0 then
    update parts set quantity_on_hand = quantity_on_hand - v_delta where id = v_part_id;
    insert into inventory_movements (movement_type, part_id, qty_delta, ref_table, ref_id, notes)
    values ('WO_ISSUE', v_part_id, -v_delta, 'work_orders', v_wo_id, 'WO qty change (delta)');
  end if;
end $$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: accounting_integration_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_integration_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    provider text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    transfer_mode text DEFAULT 'IMPORT_ONLY'::text NOT NULL,
    export_trigger text,
    income_account_parts text,
    income_account_labor text,
    income_account_fees text,
    income_account_sublet text,
    liability_account_sales_tax text,
    qb_customer_ref text,
    qb_item_ref_parts text,
    qb_item_ref_labor text,
    qb_item_ref_fees_sublet text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounting_integration_config_transfer_mode_check CHECK ((transfer_mode = ANY (ARRAY['IMPORT_ONLY'::text, 'LIVE_TRANSFER'::text])))
);

ALTER TABLE ONLY public.accounting_integration_config FORCE ROW LEVEL SECURITY;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    movement_type public.inventory_movement_type NOT NULL,
    part_id uuid NOT NULL,
    qty_delta integer NOT NULL,
    ref_table text,
    ref_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_table text,
    source_id uuid,
    reason text,
    meta jsonb DEFAULT '{}'::jsonb
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_id uuid NOT NULL,
    qty_delta integer NOT NULL,
    reason text NOT NULL,
    ref_type text NOT NULL,
    ref_id uuid NOT NULL,
    ref_line_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufactured_product_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufactured_product_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    option_type text NOT NULL,
    price_delta numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufactured_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufactured_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    product_type text NOT NULL,
    description text,
    base_price numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    estimated_labor_hours numeric DEFAULT 0 NOT NULL,
    estimated_overhead numeric DEFAULT 0 NOT NULL,
    tenant_id uuid DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL
);


--
-- Name: manufacturing_build_selected_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_build_selected_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    build_id uuid NOT NULL,
    option_id uuid,
    option_name_snapshot text NOT NULL,
    price_delta_snapshot numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufacturing_builds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_builds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    build_number text NOT NULL,
    customer_id uuid,
    unit_id uuid,
    product_id uuid NOT NULL,
    status text DEFAULT 'ENGINEERING'::text NOT NULL,
    serial_number text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    promised_date date,
    assigned_technician_id uuid,
    internal_job_number text
);


--
-- Name: manufacturing_job_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_job_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    manufacturing_job_id uuid NOT NULL,
    operation_type text NOT NULL,
    operation_params_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    derived_cost numeric(12,2) NOT NULL,
    labor_cost numeric(12,2) DEFAULT 0 NOT NULL,
    machine_cost numeric(12,2) DEFAULT 0 NOT NULL,
    actual_hours numeric
);


--
-- Name: manufacturing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    source_template_version_id uuid,
    job_name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    calculated_cost numeric(12,2) NOT NULL,
    cost_breakdown_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid() NOT NULL,
    CONSTRAINT manufacturing_jobs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'completed'::text, 'canceled'::text])))
);


--
-- Name: manufacturing_material_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_material_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    template_version_id uuid NOT NULL,
    name text NOT NULL,
    spec text NOT NULL,
    estimated_quantity numeric,
    unit text,
    scrap_factor_percent numeric,
    notes text
);


--
-- Name: manufacturing_product_boms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_product_boms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    part_id uuid NOT NULL,
    quantity numeric NOT NULL,
    scrap_factor numeric DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_mfg_product_boms_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_mfg_product_boms_scrap_factor CHECK ((scrap_factor >= (0)::numeric)),
    CONSTRAINT manufacturing_product_boms_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT manufacturing_product_boms_scrap_factor_check CHECK ((scrap_factor >= (0)::numeric))
);


--
-- Name: manufacturing_product_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_product_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    sku_suffix text,
    price_delta numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufacturing_template_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_template_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    template_version_id uuid NOT NULL,
    operation_type text NOT NULL,
    estimated_hours numeric DEFAULT 0 NOT NULL,
    skill_type text DEFAULT 'general'::text NOT NULL,
    machine_type text,
    operation_params_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: manufacturing_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    template_id uuid NOT NULL,
    version_number integer NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    material_spec_json jsonb NOT NULL,
    cost_model_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid() NOT NULL
);


--
-- Name: manufacturing_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid() NOT NULL,
    draft_json jsonb
);


--
-- Name: part_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.part_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number text NOT NULL,
    description text NOT NULL,
    vendor_id uuid NOT NULL,
    category_id uuid NOT NULL,
    cost numeric(12,2) DEFAULT 0 NOT NULL,
    sell_price numeric(12,2) DEFAULT 0 NOT NULL,
    quantity_on_hand integer DEFAULT 0 NOT NULL,
    core_required boolean DEFAULT false NOT NULL,
    core_charge_amount numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL
);

ALTER TABLE ONLY public.parts FORCE ROW LEVEL SECURITY;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    order_type text NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    method text NOT NULL,
    reference text,
    notes text,
    voided_at timestamp with time zone,
    void_reason text,
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric))
);

ALTER TABLE ONLY public.payments FORCE ROW LEVEL SECURITY;


--
-- Name: pricing_override_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_override_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    entity_type text NOT NULL,
    event_type text NOT NULL,
    order_id uuid NOT NULL,
    line_id uuid NOT NULL,
    part_id uuid,
    old_unit_price numeric(12,2) NOT NULL,
    new_unit_price numeric(12,2) NOT NULL,
    reason text,
    user_id uuid,
    approval_required boolean DEFAULT false NOT NULL,
    approved_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_override_log_entity_type_check CHECK ((entity_type = ANY (ARRAY['SALES_ORDER_LINE'::text, 'WORK_ORDER_PART_LINE'::text]))),
    CONSTRAINT pricing_override_log_event_type_check CHECK ((event_type = ANY (ARRAY['override_enabled'::text, 'override_price_changed'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text DEFAULT 'TECH'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active_tenant_id uuid
);


--
-- Name: purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    part_id uuid NOT NULL,
    qty_ordered integer NOT NULL,
    qty_received integer DEFAULT 0 NOT NULL,
    unit_cost_snapshot numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_order_lines_check CHECK ((qty_received <= qty_ordered)),
    CONSTRAINT purchase_order_lines_qty_ordered_check CHECK ((qty_ordered > 0)),
    CONSTRAINT purchase_order_lines_qty_received_check CHECK ((qty_received >= 0))
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text NOT NULL,
    vendor_id uuid NOT NULL,
    status public.purchase_order_status DEFAULT 'OPEN'::public.purchase_order_status NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone
);


--
-- Name: receiving_event_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_event_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receiving_event_id uuid NOT NULL,
    purchase_order_line_id uuid NOT NULL,
    qty_received integer NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT receiving_event_lines_qty_received_check CHECK ((qty_received > 0))
);


--
-- Name: receiving_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.roles FORCE ROW LEVEL SECURITY;


--
-- Name: sales_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sales_order_id uuid NOT NULL,
    part_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_price_snapshot numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    is_warranty boolean DEFAULT false NOT NULL,
    core_required boolean DEFAULT false NOT NULL,
    core_charge_amount numeric(12,2) DEFAULT 0 NOT NULL,
    core_returned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    core_charge numeric,
    unit_price numeric,
    CONSTRAINT sales_order_lines_qty_check CHECK ((qty > 0))
);


--
-- Name: sales_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text DEFAULT ('SO-'::text || lpad((nextval('public.sales_order_number_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    status public.sales_order_status DEFAULT 'OPEN'::public.sales_order_status NOT NULL,
    is_walk_in boolean DEFAULT false NOT NULL,
    walk_in_name text,
    customer_id uuid,
    unit_id uuid,
    tax_rate_snapshot numeric(6,4) DEFAULT 0.0000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoiced_at timestamp with time zone,
    notes text,
    tax_rate numeric,
    subtotal numeric,
    core_charges_total numeric,
    tax_amount numeric,
    total numeric
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_name text DEFAULT 'Repair Hub Pro'::text NOT NULL,
    default_labor_rate numeric(12,2) DEFAULT 150.00 NOT NULL,
    default_tax_rate numeric(6,4) DEFAULT 0.0000 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    units text DEFAULT 'imperial'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.system_settings FORCE ROW LEVEL SECURITY;


--
-- Name: technician_time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    work_order_id uuid NOT NULL,
    clock_in timestamp with time zone DEFAULT now() NOT NULL,
    clock_out timestamp with time zone,
    total_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: technicians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technicians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    hourly_cost_rate numeric(12,2) DEFAULT 0 NOT NULL,
    default_billable_rate numeric(12,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_users (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.unit_types FORCE ROW LEVEL SECURITY;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    unit_name text NOT NULL,
    vin text NOT NULL,
    year integer,
    make text,
    model text,
    mileage_hours numeric(12,1),
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    unit_type_id uuid,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    username text
);

ALTER TABLE ONLY public.user_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid,
    role_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.user_roles FORCE ROW LEVEL SECURITY;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_order_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'INTAKE'::text NOT NULL,
    complaint text,
    cause text,
    correction text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: work_order_labor_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_labor_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    work_type text NOT NULL,
    technician_name text,
    hours numeric(12,2) NOT NULL,
    labor_rate_snapshot numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    is_warranty boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT work_order_labor_lines_hours_check CHECK ((hours >= (0)::numeric))
);


--
-- Name: work_order_part_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_part_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_id uuid NOT NULL,
    part_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_price_snapshot numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    is_warranty boolean DEFAULT false NOT NULL,
    core_required boolean DEFAULT false NOT NULL,
    core_charge_amount numeric(12,2) DEFAULT 0 NOT NULL,
    core_returned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT work_order_part_lines_qty_check CHECK ((qty > 0))
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_number text NOT NULL,
    status public.work_order_status DEFAULT 'OPEN'::public.work_order_status NOT NULL,
    customer_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    labor_rate_snapshot numeric(12,2) NOT NULL,
    tax_rate_snapshot numeric(6,4) DEFAULT 0.0000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoiced_at timestamp with time zone,
    complaint text,
    cause text,
    correction text,
    tenant_id uuid DEFAULT public.current_tenant_id() NOT NULL
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: accounting_integration_config accounting_integration_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_integration_config
    ADD CONSTRAINT accounting_integration_config_pkey PRIMARY KEY (id);


--
-- Name: accounting_integration_config accounting_integration_config_provider_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_integration_config
    ADD CONSTRAINT accounting_integration_config_provider_unique UNIQUE (tenant_id, provider);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: manufactured_product_options manufactured_product_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufactured_product_options
    ADD CONSTRAINT manufactured_product_options_pkey PRIMARY KEY (id);


--
-- Name: manufactured_products manufactured_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufactured_products
    ADD CONSTRAINT manufactured_products_pkey PRIMARY KEY (id);


--
-- Name: manufactured_products manufactured_products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufactured_products
    ADD CONSTRAINT manufactured_products_sku_key UNIQUE (sku);


--
-- Name: manufacturing_build_selected_options manufacturing_build_selected_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_build_selected_options
    ADD CONSTRAINT manufacturing_build_selected_options_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_builds manufacturing_builds_build_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_builds
    ADD CONSTRAINT manufacturing_builds_build_number_key UNIQUE (build_number);


--
-- Name: manufacturing_builds manufacturing_builds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_builds
    ADD CONSTRAINT manufacturing_builds_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_job_operations manufacturing_job_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_job_operations
    ADD CONSTRAINT manufacturing_job_operations_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_jobs manufacturing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_jobs
    ADD CONSTRAINT manufacturing_jobs_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_material_groups manufacturing_material_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_material_groups
    ADD CONSTRAINT manufacturing_material_groups_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_product_boms manufacturing_product_boms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_boms
    ADD CONSTRAINT manufacturing_product_boms_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_product_options manufacturing_product_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_options
    ADD CONSTRAINT manufacturing_product_options_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_product_options manufacturing_product_options_tenant_id_product_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_options
    ADD CONSTRAINT manufacturing_product_options_tenant_id_product_id_name_key UNIQUE (tenant_id, product_id, name);


--
-- Name: manufacturing_template_operations manufacturing_template_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_template_operations
    ADD CONSTRAINT manufacturing_template_operations_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_template_versions manufacturing_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_template_versions
    ADD CONSTRAINT manufacturing_template_versions_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_templates manufacturing_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_templates
    ADD CONSTRAINT manufacturing_templates_pkey PRIMARY KEY (id);


--
-- Name: part_categories part_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.part_categories
    ADD CONSTRAINT part_categories_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pricing_override_log pricing_override_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_override_log
    ADD CONSTRAINT pricing_override_log_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_lines purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: receiving_event_lines receiving_event_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_event_lines
    ADD CONSTRAINT receiving_event_lines_pkey PRIMARY KEY (id);


--
-- Name: receiving_events receiving_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_events
    ADD CONSTRAINT receiving_events_pkey PRIMARY KEY (id);


--
-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_order_lines sales_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_lines
    ADD CONSTRAINT sales_order_lines_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: technician_time_entries technician_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_time_entries
    ADD CONSTRAINT technician_time_entries_pkey PRIMARY KEY (id);


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_pkey PRIMARY KEY (id);


--
-- Name: tenant_users tenant_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_pkey PRIMARY KEY (tenant_id, user_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: unit_types unit_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_product_boms uq_mfg_product_boms_tenant_product_part; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_boms
    ADD CONSTRAINT uq_mfg_product_boms_tenant_product_part UNIQUE (tenant_id, product_id, part_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: work_order_jobs work_order_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_jobs
    ADD CONSTRAINT work_order_jobs_pkey PRIMARY KEY (id);


--
-- Name: work_order_labor_lines work_order_labor_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_labor_lines
    ADD CONSTRAINT work_order_labor_lines_pkey PRIMARY KEY (id);


--
-- Name: work_order_part_lines work_order_part_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_part_lines
    ADD CONSTRAINT work_order_part_lines_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_inv_txn_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_txn_part ON public.inventory_transactions USING btree (part_id);


--
-- Name: idx_inv_txn_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_txn_ref ON public.inventory_transactions USING btree (ref_type, ref_id);


--
-- Name: idx_manufactured_product_options_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufactured_product_options_product_id ON public.manufactured_product_options USING btree (product_id);


--
-- Name: idx_manufactured_products_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufactured_products_product_type ON public.manufactured_products USING btree (product_type);


--
-- Name: idx_manufactured_products_tenant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufactured_products_tenant_active ON public.manufactured_products USING btree (tenant_id, is_active);


--
-- Name: idx_manufactured_products_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufactured_products_tenant_name ON public.manufactured_products USING btree (tenant_id, name);


--
-- Name: idx_manufacturing_builds_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufacturing_builds_customer_id ON public.manufacturing_builds USING btree (customer_id);


--
-- Name: idx_manufacturing_builds_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufacturing_builds_product_id ON public.manufacturing_builds USING btree (product_id);


--
-- Name: idx_mfg_product_boms_part_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfg_product_boms_part_id ON public.manufacturing_product_boms USING btree (part_id);


--
-- Name: idx_mfg_product_boms_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfg_product_boms_product_id ON public.manufacturing_product_boms USING btree (product_id);


--
-- Name: idx_mfg_product_boms_tenant_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfg_product_boms_tenant_part ON public.manufacturing_product_boms USING btree (tenant_id, part_id);


--
-- Name: idx_mfg_product_boms_tenant_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfg_product_boms_tenant_product ON public.manufacturing_product_boms USING btree (tenant_id, product_id);


--
-- Name: idx_mfg_product_options_tenant_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfg_product_options_tenant_product ON public.manufacturing_product_options USING btree (tenant_id, product_id);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);


--
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order ON public.payments USING btree (order_type, order_id);


--
-- Name: idx_sales_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_customer ON public.sales_orders USING btree (customer_id);


--
-- Name: idx_sales_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_status ON public.sales_orders USING btree (status);


--
-- Name: idx_selected_options_build_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_selected_options_build_id ON public.manufacturing_build_selected_options USING btree (build_id);


--
-- Name: idx_so_lines_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_so_lines_order ON public.sales_order_lines USING btree (sales_order_id);


--
-- Name: idx_so_lines_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_so_lines_part ON public.sales_order_lines USING btree (part_id);


--
-- Name: inventory_movements_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_created_at_idx ON public.inventory_movements USING btree (created_at);


--
-- Name: inventory_movements_part_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_part_id_idx ON public.inventory_movements USING btree (part_id);


--
-- Name: inventory_movements_source_part_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_movements_source_part_unique ON public.inventory_movements USING btree (source_table, source_id, part_id);


--
-- Name: manufacturing_job_operations_job_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_job_operations_job_id_idx ON public.manufacturing_job_operations USING btree (manufacturing_job_id);


--
-- Name: manufacturing_job_operations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_job_operations_tenant_id_idx ON public.manufacturing_job_operations USING btree (tenant_id);


--
-- Name: manufacturing_jobs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_jobs_status_idx ON public.manufacturing_jobs USING btree (status);


--
-- Name: manufacturing_jobs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_jobs_tenant_id_idx ON public.manufacturing_jobs USING btree (tenant_id);


--
-- Name: manufacturing_material_groups_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_material_groups_tenant_id_idx ON public.manufacturing_material_groups USING btree (tenant_id);


--
-- Name: manufacturing_material_groups_version_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_material_groups_version_id_idx ON public.manufacturing_material_groups USING btree (template_version_id);


--
-- Name: manufacturing_template_operations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_template_operations_tenant_id_idx ON public.manufacturing_template_operations USING btree (tenant_id);


--
-- Name: manufacturing_template_operations_version_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_template_operations_version_id_idx ON public.manufacturing_template_operations USING btree (template_version_id);


--
-- Name: manufacturing_template_versions_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_template_versions_tenant_id_idx ON public.manufacturing_template_versions USING btree (tenant_id);


--
-- Name: manufacturing_templates_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturing_templates_tenant_id_idx ON public.manufacturing_templates USING btree (tenant_id);


--
-- Name: manufacturing_templates_tenant_name_ux; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX manufacturing_templates_tenant_name_ux ON public.manufacturing_templates USING btree (tenant_id, name);


--
-- Name: mtv_one_current_ux; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mtv_one_current_ux ON public.manufacturing_template_versions USING btree (template_id) WHERE (is_current = true);


--
-- Name: mtv_version_unique_ux; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mtv_version_unique_ux ON public.manufacturing_template_versions USING btree (template_id, version_number);


--
-- Name: pricing_override_log_order_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pricing_override_log_order_line ON public.pricing_override_log USING btree (order_id, line_id);


--
-- Name: pricing_override_log_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pricing_override_log_tenant_created_at ON public.pricing_override_log USING btree (tenant_id, created_at DESC);


--
-- Name: profiles_active_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_active_tenant_id_idx ON public.profiles USING btree (active_tenant_id);


--
-- Name: tenant_users_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_users_user_id_idx ON public.tenant_users USING btree (user_id);


--
-- Name: unit_types_tenant_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_types_tenant_active_idx ON public.unit_types USING btree (tenant_id, is_active);


--
-- Name: unit_types_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_types_tenant_id_idx ON public.unit_types USING btree (tenant_id);


--
-- Name: unit_types_tenant_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_types_tenant_name_unique ON public.unit_types USING btree (tenant_id, lower(name));


--
-- Name: units_unit_type_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX units_unit_type_id_idx ON public.units USING btree (unit_type_id);


--
-- Name: user_profiles_username_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_profiles_username_unique ON public.user_profiles USING btree (lower(username)) WHERE (username IS NOT NULL);


--
-- Name: ux_customers_company_name_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_customers_company_name_ci ON public.customers USING btree (lower(company_name));


--
-- Name: ux_customers_phone_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_customers_phone_norm ON public.customers USING btree (public.normalize_phone(phone)) WHERE (public.normalize_phone(phone) IS NOT NULL);


--
-- Name: ux_inv_txn_unique_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_inv_txn_unique_event ON public.inventory_transactions USING btree (ref_type, ref_id, part_id);


--
-- Name: ux_part_categories_name_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_part_categories_name_ci ON public.part_categories USING btree (lower(name));


--
-- Name: ux_parts_part_number_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_parts_part_number_ci ON public.parts USING btree (lower(part_number));


--
-- Name: ux_po_lines_unique_part; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_po_lines_unique_part ON public.purchase_order_lines USING btree (purchase_order_id, part_id);


--
-- Name: ux_purchase_orders_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_purchase_orders_number ON public.purchase_orders USING btree (po_number);


--
-- Name: ux_sales_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_sales_orders_order_number ON public.sales_orders USING btree (order_number);


--
-- Name: ux_so_lines_unique_part; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_so_lines_unique_part ON public.sales_order_lines USING btree (sales_order_id, part_id);


--
-- Name: ux_technicians_name_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_technicians_name_ci ON public.technicians USING btree (lower(name));


--
-- Name: ux_time_open_one_per_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_time_open_one_per_tech ON public.technician_time_entries USING btree (technician_id) WHERE (clock_out IS NULL);


--
-- Name: ux_units_customer_unitname_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_units_customer_unitname_ci ON public.units USING btree (customer_id, lower(unit_name));


--
-- Name: ux_units_vin_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_units_vin_ci ON public.units USING btree (lower(vin));


--
-- Name: ux_vendors_name_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_vendors_name_ci ON public.vendors USING btree (lower(name));


--
-- Name: ux_wo_part_lines_unique_part; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_wo_part_lines_unique_part ON public.work_order_part_lines USING btree (work_order_id, part_id);


--
-- Name: ux_work_orders_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_work_orders_number ON public.work_orders USING btree (work_order_number);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: manufactured_products set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.manufactured_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: manufacturing_product_boms set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.manufacturing_product_boms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: manufacturing_product_options set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.manufacturing_product_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers trg_customers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments trg_enforce_payments_void_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_payments_void_only BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_payments_void_only();


--
-- Name: part_categories trg_part_categories_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_part_categories_updated BEFORE UPDATE ON public.part_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: parts trg_parts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parts_updated BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_order_lines trg_po_lines_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_po_lines_updated BEFORE UPDATE ON public.purchase_order_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_orders trg_purchase_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_orders trg_sales_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_orders_updated BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_order_lines trg_so_lines_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_so_lines_updated BEFORE UPDATE ON public.sales_order_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: system_settings trg_system_settings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: technicians trg_technicians_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_technicians_updated BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: technician_time_entries trg_time_entries_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_time_entries_updated BEFORE UPDATE ON public.technician_time_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: units trg_units_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vendors trg_vendors_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: work_order_labor_lines trg_wo_labor_lines_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wo_labor_lines_updated BEFORE UPDATE ON public.work_order_labor_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: work_order_part_lines trg_wo_part_lines_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wo_part_lines_updated BEFORE UPDATE ON public.work_order_part_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: work_orders trg_work_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id);


--
-- Name: inventory_transactions inventory_transactions_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id);


--
-- Name: manufactured_product_options manufactured_product_options_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufactured_product_options
    ADD CONSTRAINT manufactured_product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.manufactured_products(id) ON DELETE CASCADE;


--
-- Name: manufacturing_build_selected_options manufacturing_build_selected_options_build_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_build_selected_options
    ADD CONSTRAINT manufacturing_build_selected_options_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.manufacturing_builds(id) ON DELETE CASCADE;


--
-- Name: manufacturing_build_selected_options manufacturing_build_selected_options_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_build_selected_options
    ADD CONSTRAINT manufacturing_build_selected_options_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.manufactured_product_options(id);


--
-- Name: manufacturing_builds manufacturing_builds_assigned_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_builds
    ADD CONSTRAINT manufacturing_builds_assigned_technician_id_fkey FOREIGN KEY (assigned_technician_id) REFERENCES public.technicians(id);


--
-- Name: manufacturing_builds manufacturing_builds_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_builds
    ADD CONSTRAINT manufacturing_builds_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: manufacturing_builds manufacturing_builds_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_builds
    ADD CONSTRAINT manufacturing_builds_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.manufactured_products(id);


--
-- Name: manufacturing_builds manufacturing_builds_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_builds
    ADD CONSTRAINT manufacturing_builds_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: manufacturing_job_operations manufacturing_job_operations_manufacturing_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_job_operations
    ADD CONSTRAINT manufacturing_job_operations_manufacturing_job_id_fkey FOREIGN KEY (manufacturing_job_id) REFERENCES public.manufacturing_jobs(id) ON DELETE CASCADE;


--
-- Name: manufacturing_jobs manufacturing_jobs_source_template_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_jobs
    ADD CONSTRAINT manufacturing_jobs_source_template_version_id_fkey FOREIGN KEY (source_template_version_id) REFERENCES public.manufacturing_template_versions(id);


--
-- Name: manufacturing_material_groups manufacturing_material_groups_template_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_material_groups
    ADD CONSTRAINT manufacturing_material_groups_template_version_id_fkey FOREIGN KEY (template_version_id) REFERENCES public.manufacturing_template_versions(id) ON DELETE CASCADE;


--
-- Name: manufacturing_product_boms manufacturing_product_boms_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_boms
    ADD CONSTRAINT manufacturing_product_boms_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE RESTRICT;


--
-- Name: manufacturing_product_boms manufacturing_product_boms_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_boms
    ADD CONSTRAINT manufacturing_product_boms_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.manufactured_products(id) ON DELETE CASCADE;


--
-- Name: manufacturing_product_options manufacturing_product_options_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_product_options
    ADD CONSTRAINT manufacturing_product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.manufactured_products(id) ON DELETE CASCADE;


--
-- Name: manufacturing_template_operations manufacturing_template_operations_template_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_template_operations
    ADD CONSTRAINT manufacturing_template_operations_template_version_id_fkey FOREIGN KEY (template_version_id) REFERENCES public.manufacturing_template_versions(id) ON DELETE CASCADE;


--
-- Name: manufacturing_template_versions manufacturing_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_template_versions
    ADD CONSTRAINT manufacturing_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.manufacturing_templates(id) ON DELETE CASCADE;


--
-- Name: parts parts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.part_categories(id);


--
-- Name: parts parts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id);


--
-- Name: purchase_order_lines purchase_order_lines_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: receiving_event_lines receiving_event_lines_purchase_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_event_lines
    ADD CONSTRAINT receiving_event_lines_purchase_order_line_id_fkey FOREIGN KEY (purchase_order_line_id) REFERENCES public.purchase_order_lines(id) ON DELETE CASCADE;


--
-- Name: receiving_event_lines receiving_event_lines_receiving_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_event_lines
    ADD CONSTRAINT receiving_event_lines_receiving_event_id_fkey FOREIGN KEY (receiving_event_id) REFERENCES public.receiving_events(id) ON DELETE CASCADE;


--
-- Name: receiving_events receiving_events_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_events
    ADD CONSTRAINT receiving_events_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: sales_order_lines sales_order_lines_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_lines
    ADD CONSTRAINT sales_order_lines_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id);


--
-- Name: sales_order_lines sales_order_lines_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_lines
    ADD CONSTRAINT sales_order_lines_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales_orders sales_orders_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: technician_time_entries technician_time_entries_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_time_entries
    ADD CONSTRAINT technician_time_entries_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id);


--
-- Name: technician_time_entries technician_time_entries_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_time_entries
    ADD CONSTRAINT technician_time_entries_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: units units_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: units units_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_types(id);


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: work_order_jobs work_order_jobs_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_jobs
    ADD CONSTRAINT work_order_jobs_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_labor_lines work_order_labor_lines_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_labor_lines
    ADD CONSTRAINT work_order_labor_lines_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_part_lines work_order_part_lines_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_part_lines
    ADD CONSTRAINT work_order_part_lines_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id);


--
-- Name: work_order_part_lines work_order_part_lines_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_part_lines
    ADD CONSTRAINT work_order_part_lines_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: work_orders work_orders_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_integration_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_integration_config ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_integration_config aic_select_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aic_select_tenant ON public.accounting_integration_config FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: accounting_integration_config aic_write_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aic_write_admin_only ON public.accounting_integration_config USING (((tenant_id = public.current_tenant_id()) AND (public.current_app_role() = 'ADMIN'::text))) WITH CHECK (((tenant_id = public.current_tenant_id()) AND (public.current_app_role() = 'ADMIN'::text)));


--
-- Name: manufactured_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufactured_products ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_job_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_job_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_material_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_material_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_product_boms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_product_boms ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_product_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_product_options ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_template_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_template_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_template_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_template_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manufacturing_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: manufacturing_jobs mj_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mj_insert ON public.manufacturing_jobs FOR INSERT WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_jobs mj_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mj_select ON public.manufacturing_jobs FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_jobs mj_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mj_update ON public.manufacturing_jobs FOR UPDATE USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_job_operations mjo_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mjo_insert ON public.manufacturing_job_operations FOR INSERT WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_job_operations mjo_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mjo_select ON public.manufacturing_job_operations FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_job_operations mjo_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mjo_update ON public.manufacturing_job_operations FOR UPDATE USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_material_groups mmg_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mmg_insert ON public.manufacturing_material_groups FOR INSERT WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_material_groups mmg_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mmg_select ON public.manufacturing_material_groups FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_material_groups mmg_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mmg_update ON public.manufacturing_material_groups FOR UPDATE USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_templates mt_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mt_insert ON public.manufacturing_templates FOR INSERT WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_templates mt_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mt_select ON public.manufacturing_templates FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_templates mt_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mt_update ON public.manufacturing_templates FOR UPDATE USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_template_operations mto_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mto_insert ON public.manufacturing_template_operations FOR INSERT WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_template_operations mto_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mto_select ON public.manufacturing_template_operations FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_template_operations mto_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mto_update ON public.manufacturing_template_operations FOR UPDATE USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_template_versions mtv_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mtv_insert ON public.manufacturing_template_versions FOR INSERT WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_template_versions mtv_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mtv_select ON public.manufacturing_template_versions FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: manufacturing_template_versions mtv_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mtv_update ON public.manufacturing_template_versions FOR UPDATE USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: parts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

--
-- Name: parts parts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_delete ON public.parts FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_delete_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_delete_delete ON public.parts FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_insert ON public.parts FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_insert_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_insert_insert ON public.parts FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_select ON public.parts FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_select_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_select_select ON public.parts FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_update ON public.parts FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: parts parts_update_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parts_update_update ON public.parts FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_insert_record_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_insert_record_roles ON public.payments FOR INSERT TO authenticated WITH CHECK ((public.current_app_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'service_writer'::text])));


--
-- Name: payments payments_select_record_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_select_record_roles ON public.payments FOR SELECT TO authenticated USING ((public.current_app_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'service_writer'::text])));


--
-- Name: payments payments_update_void_transition_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_update_void_transition_only ON public.payments FOR UPDATE TO authenticated USING (((public.current_app_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'service_writer'::text])) AND (voided_at IS NULL))) WITH CHECK (((public.current_app_role() = ANY (ARRAY['admin'::text, 'manager'::text, 'service_writer'::text])) AND (voided_at IS NOT NULL)));


--
-- Name: pricing_override_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_override_log ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_override_log pricing_override_log_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_override_log_delete ON public.pricing_override_log FOR DELETE USING (false);


--
-- Name: pricing_override_log pricing_override_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_override_log_insert ON public.pricing_override_log FOR INSERT WITH CHECK (((public.current_tenant_id() IS NOT NULL) AND ((tenant_id = public.current_tenant_id()) OR (tenant_id IS NULL))));


--
-- Name: pricing_override_log pricing_override_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_override_log_select ON public.pricing_override_log FOR SELECT USING ((tenant_id = public.current_tenant_id()));


--
-- Name: pricing_override_log pricing_override_log_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_override_log_update ON public.pricing_override_log FOR UPDATE USING (false);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles: insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles: read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: read own" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: roles roles_write_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_write_admin_only ON public.roles TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings: read authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system_settings: read authenticated" ON public.system_settings FOR SELECT TO authenticated USING (true);


--
-- Name: system_settings system_settings: write admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "system_settings: write admin" ON public.system_settings TO authenticated USING ((public.app_role() = 'ADMIN'::text)) WITH CHECK ((public.app_role() = 'ADMIN'::text));


--
-- Name: system_settings system_settings_insert_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_insert_admin_only ON public.system_settings FOR INSERT TO authenticated WITH CHECK ((public.current_app_role() = 'admin'::text));


--
-- Name: system_settings system_settings_select_all_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_select_all_authenticated ON public.system_settings FOR SELECT TO authenticated USING (true);


--
-- Name: system_settings system_settings_update_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_update_admin_only ON public.system_settings FOR UPDATE TO authenticated USING ((public.current_app_role() = 'admin'::text)) WITH CHECK ((public.current_app_role() = 'admin'::text));


--
-- Name: manufactured_products tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.manufactured_products FOR DELETE USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_boms tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.manufacturing_product_boms FOR DELETE USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_options tenant_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_delete ON public.manufacturing_product_options FOR DELETE USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufactured_products tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.manufactured_products FOR INSERT WITH CHECK ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_boms tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.manufacturing_product_boms FOR INSERT WITH CHECK ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_options tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.manufacturing_product_options FOR INSERT WITH CHECK ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufactured_products tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.manufactured_products FOR SELECT USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_boms tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.manufacturing_product_boms FOR SELECT USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_options tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_select ON public.manufacturing_product_options FOR SELECT USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufactured_products tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.manufactured_products FOR UPDATE USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_boms tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.manufacturing_product_boms FOR UPDATE USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: manufacturing_product_options tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_update ON public.manufacturing_product_options FOR UPDATE USING ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid));


--
-- Name: unit_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unit_types ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_types unit_types_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unit_types_delete ON public.unit_types FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: unit_types unit_types_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unit_types_insert ON public.unit_types FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: unit_types unit_types_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unit_types_select ON public.unit_types FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: unit_types unit_types_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY unit_types_update ON public.unit_types FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_delete_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_delete_delete ON public.units FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: units units_insert_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_insert_insert ON public.units FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: units units_select_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_select_select ON public.units FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: units units_update_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_update_update ON public.units FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles user_profiles_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_select_admin ON public.user_profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: user_profiles user_profiles_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_select_self ON public.user_profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: user_profiles user_profiles_write_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_write_admin_only ON public.user_profiles TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_admin ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: user_roles user_roles_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_roles user_roles_write_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_write_admin_only ON public.user_roles TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: work_orders work_orders_delete_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_orders_delete_delete ON public.work_orders FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: work_orders work_orders_insert_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_orders_insert_insert ON public.work_orders FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: work_orders work_orders_select_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_orders_select_select ON public.work_orders FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id()));


--
-- Name: work_orders work_orders_update_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_orders_update_update ON public.work_orders FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id())) WITH CHECK ((tenant_id = public.current_tenant_id()));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict zhowYHacbLzPou3WPKquNbThmfBxTkc0WZX2NGOCbjhQ0Iwced2q2bwCsuKO4Jp

