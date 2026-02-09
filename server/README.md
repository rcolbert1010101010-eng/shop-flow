# ShopFlow API Server

## Admin API Key

Set `SHOPFLOW_ADMIN_API_KEY` before starting the server.

Example:

```bash
export SHOPFLOW_ADMIN_API_KEY="replace-with-strong-random-key"
npm run dev --prefix server
```

## Admin Ping Endpoint

Call the gated endpoint with header `x-shopflow-admin-key`:

```bash
curl -i \
  -H "x-shopflow-admin-key: $SHOPFLOW_ADMIN_API_KEY" \
  http://localhost:4000/api/v1/admin/ping
```

Expected response:

```json
{"ok":true}
```
