# admin-create-user (Supabase Edge Function)

Creates a new user and assigns a role (server-side, no service key in the client).

## Required environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Payload
```json
{ "email": "user@example.com", "full_name": "User Name", "role_key": "admin" }
```

## Notes
- Caller must be authenticated and pass `is_admin(auth.uid())`.
- Uses `auth.admin.inviteUserByEmail` (no passwords handled in the client).
