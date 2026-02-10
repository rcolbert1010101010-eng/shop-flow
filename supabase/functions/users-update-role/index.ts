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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders });

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(403, { error: 'not_admin' });
  }

  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  const caller = authData?.user;
  if (authError || !caller) {
    return jsonResponse(403, { error: 'not_admin' });
  }

  let payload: { tenant_id?: string; user_id?: string; role_key?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const tenantId = (payload.tenant_id ?? '').toString().trim();
  const userId = (payload.user_id ?? '').toString().trim();
  const roleKey = (payload.role_key ?? '').toString().trim().toLowerCase();

  if (!tenantId || !userId || !roleKey) {
    return jsonResponse(400, { error: 'tenant_id, user_id, and role_key are required' });
  }
  if (!isUuid(tenantId)) {
    return jsonResponse(400, { error: 'tenant_id must be a UUID' });
  }
  if (!isUuid(userId)) {
    return jsonResponse(400, { error: 'user_id must be a UUID' });
  }

  const { data: isAdmin, error: isAdminError } = await adminClient.rpc('is_admin', { uid: caller.id });
  if (isAdminError) {
    return jsonResponse(500, { error: 'Admin check failed' });
  }
  if (!isAdmin) {
    return jsonResponse(403, { error: 'not_admin' });
  }

  const { data: callerMembership, error: callerMembershipError } = await adminClient
    .from('tenant_users')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', caller.id)
    .maybeSingle();

  if (callerMembershipError) {
    return jsonResponse(500, { error: 'Tenant membership lookup failed' });
  }
  if (!callerMembership?.tenant_id) {
    return jsonResponse(403, { error: 'not_admin' });
  }

  const { data: targetMembership, error: targetMembershipError } = await adminClient
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (targetMembershipError) {
    return jsonResponse(500, { error: 'Target membership lookup failed' });
  }
  if (!targetMembership?.user_id) {
    return jsonResponse(400, { error: 'Target user is not a tenant member' });
  }

  const { data: roleRow, error: roleError } = await adminClient
    .from('roles')
    .select('id,key')
    .eq('key', roleKey)
    .maybeSingle();

  if (roleError) {
    return jsonResponse(500, { error: 'Role lookup failed' });
  }
  if (!roleRow?.id) {
    return jsonResponse(400, { error: `Unknown role_key: ${roleKey}` });
  }

  const { data: existingRole, error: existingRoleError } = await adminClient
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingRoleError && existingRoleError.code !== 'PGRST116') {
    return jsonResponse(500, { error: 'User role lookup failed' });
  }

  if (existingRole?.role_id) {
    if (existingRole.role_id !== roleRow.id) {
      const { error: removeError } = await adminClient.from('user_roles').delete().eq('user_id', userId);
      if (removeError) {
        return jsonResponse(500, { error: removeError.message || 'Unable to update role' });
      }
      const { error: insertError } = await adminClient
        .from('user_roles')
        .insert({ user_id: userId, role_id: roleRow.id });
      if (insertError) {
        return jsonResponse(500, { error: insertError.message || 'Unable to assign role' });
      }
    }
  } else {
    const { error: insertError } = await adminClient
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleRow.id });
    if (insertError) {
      return jsonResponse(500, { error: insertError.message || 'Unable to assign role' });
    }
  }

  return jsonResponse(200, { user_id: userId, role_key: roleRow.key });
};

serve(handler);
