# Forced Password Change

## Purpose
Force first-time users (or users flagged by admins) to update their password before they can access the app. The UI blocks all other routes, requires a new password, clears the server-side flag, then routes to the dashboard.

## Key lessons
- **Never await Supabase queries inside `supabase.auth.onAuthStateChange`.** It can deadlock auth-js. Schedule profile loads after the callback returns.
- **Avoid `getSession()` / `refreshSession()` in the force-change submit path.** These calls can hang and freeze the UI. Use the Zustand session snapshot instead.
- **`profiles.must_change_password` is protected by RLS.** Clear it via a **SECURITY DEFINER** RPC (not a direct `profiles` update from the client).
- **Use timeouts + a watchdog** so the submit button never stays stuck on “Saving…”.

## DB/RPC
Use a SECURITY DEFINER function to clear the flag for the current user:

```sql
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
```

## Frontend flow
Submit sequence:
- `updateUser({ password })`
- `rpc('clear_my_must_change_password')`
- `setMustChangePassword(false)` (local store update)
- `navigate('/dashboard', { replace: true })`
- conditional hard redirect if SPA didn’t move

## Troubleshooting
- **Hangs before `updateUser` logs:** session is missing or auth state is stuck.
- **Hangs after `updateUser start` without `updateUser end`:** Supabase auth request is hung; timeout/watchdog should recover UI.
- **Hangs at profile update:** check RPC permissions and RLS; ensure SECURITY DEFINER function exists.
- **Redirect loop back to `/force-password-change`:** store `mustChangePassword` not cleared locally; ensure `setMustChangePassword(false)` runs before navigation.
