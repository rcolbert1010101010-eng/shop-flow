import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.41.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: { name?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = (payload?.name ?? '').toString().trim();
  if (!name) {
    return new Response(JSON.stringify({ error: 'name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (name.length > 120) {
    return new Response(JSON.stringify({ error: 'name is too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: tenantRow, error: tenantError } = await adminClient
    .from('tenants')
    .insert({ name })
    .select('id')
    .single();

  if (tenantError || !tenantRow?.id) {
    return new Response(JSON.stringify({ error: tenantError?.message ?? 'Unable to create tenant' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tenantId = tenantRow.id as string;

  const { error: membershipError } = await adminClient
    .from('tenant_users')
    .insert({ tenant_id: tenantId, user_id: user.id, role: 'admin' });

  if (membershipError) {
    return new Response(JSON.stringify({ error: membershipError.message ?? 'Unable to add tenant membership' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({ id: user.id, active_tenant_id: tenantId }, { onConflict: 'id' });

  if (profileError && !/does not exist/i.test(profileError.message ?? '') && profileError.code !== '42P01') {
    return new Response(JSON.stringify({ error: profileError.message ?? 'Unable to update profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ tenant_id: tenantId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
