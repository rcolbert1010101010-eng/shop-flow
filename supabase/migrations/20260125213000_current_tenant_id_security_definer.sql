-- Make tenant resolution stable and not subject to caller RLS/privileges.
-- NOTE: Preserve existing logic exactly; only add SECURITY DEFINER + safe search_path.

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

-- Optional but recommended: ensure ownership is a stable role (typically postgres in Supabase)
-- If this fails in your env, remove it and re-run the migration.
alter function public.current_tenant_id() owner to postgres;
