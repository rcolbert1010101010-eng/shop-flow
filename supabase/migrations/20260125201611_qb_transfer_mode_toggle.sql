begin;

do $do$
begin
  if to_regclass('public.accounting_integration_config') is not null then
    execute $$alter table public.accounting_integration_config add column if not exists transfer_mode text$$;
    execute $$update public.accounting_integration_config set transfer_mode = 'IMPORT_ONLY' where transfer_mode is null$$;
    execute $$alter table public.accounting_integration_config alter column transfer_mode set default 'IMPORT_ONLY'$$;
    execute $$alter table public.accounting_integration_config alter column transfer_mode set not null$$;
    begin
      execute $$alter table public.accounting_integration_config drop constraint if exists accounting_integration_config_transfer_mode_check$$;
    exception when undefined_object then null;
    end;
    execute $$alter table public.accounting_integration_config add constraint accounting_integration_config_transfer_mode_check check (transfer_mode in ('IMPORT_ONLY','LIVE_TRANSFER'))$$;
  end if;
end $do$;

commit;
