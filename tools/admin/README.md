# Scripts

## admin-create-user.mjs

BREAK-GLASS: uses service role key. Do not run casually.

Creates a user with username/password and a synthetic email (no email sent).

Example:

```bash
node scripts/admin-create-user.mjs \
  --username tech1 \
  --password "StrongPass123!" \
  --role TECHNICIAN \
  --full-name "Tech One" \
  --caller-id 110195f1-983e-42fc-9335-82589afd3b4b
```
