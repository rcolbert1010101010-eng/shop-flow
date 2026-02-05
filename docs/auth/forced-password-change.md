# Forced Password Change

## Purpose
Force first-time users (or users flagged by admins) to update their password before accessing the app. The flow updates the auth password, clears the server-side flag, updates local state, and routes to the dashboard.

## Root Causes We Hit
- **Supabase auth deadlock when awaiting Supabase calls inside `supabase.auth.onAuthStateChange`.** The callback can re-enter auth internals and wedge session state.
- **`getSession()` / `refreshSession()` can hang in wedged auth clients.** This froze the submit flow and left the UI stuck on “Saving…”.
- **RLS prevents client update to `profiles.must_change_password`.** Direct client updates are denied without a SECURITY DEFINER path.

## Authoritative Fixes
- **Keep `onAuthStateChange` synchronous; defer profile loading via `setTimeout(..., 0)`** to avoid deadlocks.
- **Avoid mandatory `getSession()` / `refreshSession()` in the submit path;** use the store session and rely on timeouts/watchdog to keep UI responsive.
- **Clear the flag via SECURITY DEFINER RPC `clear_my_must_change_password()`** instead of a direct `profiles` update.

## DB: RPC SQL
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

## Frontend Submit Sequence
- `updateUser({ password })`
- `rpc('clear_my_must_change_password')`
- `setMustChangePassword(false)` (local store update)
- `navigate('/dashboard', { replace: true })`
- conditional hard redirect if SPA didn’t move

## Troubleshooting
- **Hangs before update call:** session snapshot missing or auth store not initialized.
- **Hangs during update:** auth client wedged; timeouts/watchdog should recover UI.
- **RPC fails:** missing SECURITY DEFINER function or grants; verify migration applied.
- **Redirect loop back to `/force-password-change`:** local `mustChangePassword` not cleared before navigation.
