# admin-create-user (Supabase Edge Function)

Creates a new user and assigns a role (server-side, no service key in the client).

## Required environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

## Payload
```json
{ "username": "tech1", "password": "StrongPass123!", "role": "TECHNICIAN", "full_name": "Tech One" }
```

## Notes
- Caller must be authenticated and be ADMIN/MANAGER/OWNER for the active tenant.
- Creates a user with a synthetic email (`username@local.shopflow`) and a password (no email sent).
