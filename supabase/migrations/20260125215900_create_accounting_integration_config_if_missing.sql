-- Create accounting_integration_config if it does not exist (tenant-safe, QB-ready)

do $do$
begin
  if to_regclass('public.accounting_integration_config') is null then
    create table public.accounting_integration_config (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null default public.current_tenant_id(),
      provider text not null,
      is_enabled boolean not null default false,
      transfer_mode text not null default 'IMPORT_ONLY',
      export_trigger text null,

      -- QB income account refs (existing expected fields)
      income_account_parts text null,
      income_account_labor text null,
      income_account_fees text null,
      income_account_sublet text null,
      liability_account_sales_tax text null,

      -- Phase 7: deterministic QB mapping refs
      qb_customer_ref text null,
      qb_item_ref_parts text null,
      qb_item_ref_labor text null,
      qb_item_ref_fees_sublet text null,

      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),

      constraint accounting_integration_config_provider_unique
        unique (tenant_id, provider),

      constraint accounting_integration_config_transfer_mode_check
        check (transfer_mode in ('IMPORT_ONLY','LIVE_TRANSFER'))
    );

    alter table public.accounting_integration_config enable row level security;
    alter table public.accounting_integration_config force row level security;

    create policy "aic_select_tenant"
      on public.accounting_integration_config
      for select
      using (tenant_id = public.current_tenant_id());

    create policy "aic_write_admin_only"
      on public.accounting_integration_config
      for all
      using (
        tenant_id = public.current_tenant_id()
        and public.current_app_role() = 'ADMIN'
      )
      with check (
        tenant_id = public.current_tenant_id()
        and public.current_app_role() = 'ADMIN'
      );
  end if;
end
$do$;
