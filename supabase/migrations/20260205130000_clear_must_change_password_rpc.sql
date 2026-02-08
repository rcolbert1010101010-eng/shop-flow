create or replace function public.clear_my_must_change_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
end;
$$;

revoke all on function public.clear_my_must_change_password() from public;
grant execute on function public.clear_my_must_change_password() to authenticated;
