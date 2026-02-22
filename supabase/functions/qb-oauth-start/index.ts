// Intuit OAuth start (returns authorize URL)
// Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_REDIRECT_URI, QUICKBOOKS_STATE_HMAC_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createState } from '../_shared/qb_state.ts';

const scopes = ['com.intuit.quickbooks.accounting'];
const authBase = 'https://appcenter.intuit.com/connect/oauth2';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-shopflow-service-key, x-shopflow-tenant-id',
};

const jsonHeaders = { 'content-type': 'application/json', ...corsHeaders };

const safeErrorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) return err.message;
  return 'Internal error';
};

const jsonError = (status: number, errorCode: string, message: string, err: unknown) => {
  console.error('qb-oauth-start error', { status, error_code: errorCode, message, err: safeErrorMessage(err) });
  return new Response(JSON.stringify({ error_code: errorCode, message }), {
    status,
    headers: jsonHeaders,
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  console.log('qb-oauth-start', { method: req.method, hasAuth: !!req.headers.get('authorization') });

  const clientId = (Deno.env.get('QUICKBOOKS_CLIENT_ID') ?? '').trim();
  if (!clientId) {
    return jsonError(
      500,
      'missing_env_QUICKBOOKS_CLIENT_ID',
      'Missing required environment variable QUICKBOOKS_CLIENT_ID',
      new Error('Missing QUICKBOOKS_CLIENT_ID'),
    );
  }

  const redirectUri = (Deno.env.get('QUICKBOOKS_REDIRECT_URI') ?? '').trim();
  if (!redirectUri) {
    return jsonError(
      500,
      'missing_env_QUICKBOOKS_REDIRECT_URI',
      'Missing required environment variable QUICKBOOKS_REDIRECT_URI',
      new Error('Missing QUICKBOOKS_REDIRECT_URI'),
    );
  }

  const stateSecret = (Deno.env.get('QUICKBOOKS_STATE_HMAC_SECRET') ?? '').trim();
  if (!stateSecret) {
    return jsonError(
      500,
      'missing_env_QUICKBOOKS_STATE_HMAC_SECRET',
      'Missing required environment variable QUICKBOOKS_STATE_HMAC_SECRET',
      new Error('Missing QUICKBOOKS_STATE_HMAC_SECRET'),
    );
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
  if (!supabaseUrl) {
    return jsonError(
      500,
      'missing_env_SUPABASE_URL',
      'Missing required environment variable SUPABASE_URL',
      new Error('Missing SUPABASE_URL'),
    );
  }

  const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (!serviceRoleKey) {
    return jsonError(
      500,
      'missing_env_SUPABASE_SERVICE_ROLE_KEY',
      'Missing required environment variable SUPABASE_SERVICE_ROLE_KEY',
      new Error('Missing SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  try {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonError(401, 'unauthorized', 'Unauthorized', new Error('Missing Bearer authorization header'));
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return jsonError(401, 'unauthorized', 'Unauthorized', new Error('Missing Bearer token'));
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return jsonError(401, 'unauthorized', 'Unauthorized', new Error('Authorization Bearer token is not JWT'));
    }

    let payload: any;
    try {
      payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (decodeErr) {
      return jsonError(401, 'unauthorized', 'Unauthorized', decodeErr);
    }

    const userId = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
    if (!userId) {
      return jsonError(401, 'missing_sub', 'Missing sub claim', new Error('JWT payload missing sub'));
    }

    const sbAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonError(401, 'invalid_token', 'Invalid access token', authError ?? new Error('auth.getUser returned no user'));
    }

    if (authData.user.id && authData.user.id !== userId) {
      return jsonError(401, 'invalid_token', 'Invalid access token', new Error('Token subject mismatch'));
    }

    const requestedTenantId = (req.headers.get('x-shopflow-tenant-id') ?? '').trim();
    let tenantId: string | null = null;

    if (requestedTenantId) {
      const { data: membershipRow, error: membershipError } = await sbAdmin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userId)
        .eq('tenant_id', requestedTenantId)
        .maybeSingle();
      if (membershipError) {
        return jsonError(500, 'tenant_lookup_failed', 'Unable to verify tenant membership', membershipError);
      }
      tenantId = membershipRow?.tenant_id ?? null;
    } else {
      const { data: membershipRows, error: membershipError } = await sbAdmin
        .from('tenant_users')
        .select('tenant_id, role, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (membershipError) {
        return jsonError(500, 'tenant_lookup_failed', 'Unable to load tenant memberships', membershipError);
      }

      const memberships = Array.isArray(membershipRows) ? membershipRows : [];
      const preferred = memberships.find((row) => {
        const role = String(row?.role ?? '').toLowerCase();
        return !!row?.tenant_id && (role === 'admin' || role === 'manager');
      });
      tenantId = preferred?.tenant_id ?? memberships.find((row) => !!row?.tenant_id)?.tenant_id ?? null;
    }

    console.log('qb-oauth-start context', {
      hasUserId: !!userId,
      hasTenantId: !!tenantId,
    });

    if (!tenantId) {
      return jsonError(400, 'missing_tenant', 'Missing tenant', new Error('No tenant membership found for user'));
    }

    const state = await createState(stateSecret, tenantId, userId);

    const url = new URL(authBase);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    const authorizeUrl = url.toString();
    console.log('qb-oauth-start authorizeUrl', authorizeUrl);

    return new Response(JSON.stringify({ url: authorizeUrl }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    return jsonError(500, 'unhandled', safeErrorMessage(err), err);
  }
});
