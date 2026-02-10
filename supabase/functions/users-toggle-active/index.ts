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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  const caller = authData?.user;
  if (authError || !caller) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let payload: { user_id?: string; is_active?: boolean } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const userId = (payload.user_id ?? '').toString().trim();
  const isActive = payload.is_active;
  if (!userId || typeof isActive !== 'boolean') {
    return jsonResponse(400, { error: 'user_id and is_active are required' });
  }

  const { data: isAdmin, error: isAdminError } = await adminClient.rpc('is_admin', { uid: caller.id });
  if (isAdminError) {
    return jsonResponse(500, { error: 'Admin check failed' });
  }
  if (!isAdmin) {
    return jsonResponse(403, { error: 'Forbidden' });
  }

  const { data: tenantId, error: tenantError } = await callerClient.rpc('current_tenant_id');
  if (tenantError || !tenantId) {
    return jsonResponse(403, { error: tenantError?.message || 'Tenant not found' });
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
    return jsonResponse(403, { error: 'Forbidden' });
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
    return jsonResponse(403, { error: 'Target user is not a tenant member' });
  }

  const { data: updated, error: updateError } = await adminClient
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id,is_active')
    .maybeSingle();

  if (updateError) {
    return jsonResponse(500, { error: updateError.message || 'Unable to update user profile' });
  }
  if (!updated?.id) {
    return jsonResponse(404, { error: 'User profile not found' });
  }

  return jsonResponse(200, { user_id: updated.id, is_active: updated.is_active });
});
