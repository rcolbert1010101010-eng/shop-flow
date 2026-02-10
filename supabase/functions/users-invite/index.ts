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

  let payload: { tenant_id?: string; email?: string; role_key?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const tenantId = (payload.tenant_id ?? '').toString().trim();
  const email = (payload.email ?? '').toString().trim().toLowerCase();
  const roleKey = (payload.role_key ?? '').toString().trim().toLowerCase();

  if (!tenantId || !email || !roleKey) {
    return jsonResponse(400, { error: 'tenant_id, email, and role_key are required' });
  }
  if (!email.includes('@')) {
    return jsonResponse(400, { error: 'Invalid email' });
  }

  const { data: isAdmin, error: isAdminError } = await adminClient.rpc('is_admin', { uid: caller.id });
  if (isAdminError) {
    return jsonResponse(500, { error: 'Admin check failed' });
  }
  if (!isAdmin) {
    return jsonResponse(403, { error: 'Forbidden' });
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

  const { data: roleRow, error: roleError } = await adminClient
    .from('roles')
    .select('id,key')
    .eq('key', roleKey)
    .maybeSingle();

  if (roleError) {
    return jsonResponse(500, { error: 'Role lookup failed' });
  }
  if (!roleRow?.id) {
    return jsonResponse(400, { error: 'Invalid role_key' });
  }

  let userId: string | null = null;
  const { data: existingUser, error: existingError } = await adminClient.auth.admin.getUserByEmail(email);
  if (existingError && existingError.status !== 404) {
    return jsonResponse(500, { error: 'User lookup failed' });
  }
  if (existingUser?.user) {
    userId = existingUser.user.id;
  } else {
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError || !createdUser?.user?.id) {
      return jsonResponse(500, { error: createError?.message || 'Unable to create user' });
    }
    userId = createdUser.user.id;
  }

  if (!userId) {
    return jsonResponse(500, { error: 'User id not available' });
  }

  const { data: existingMembership, error: membershipLookupError } = await adminClient
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipLookupError) {
    return jsonResponse(500, { error: 'Tenant membership lookup failed' });
  }

  if (!existingMembership?.user_id) {
    const { error: membershipInsertError } = await adminClient
      .from('tenant_users')
      .insert({ tenant_id: tenantId, user_id: userId, role: roleKey });
    if (membershipInsertError) {
      return jsonResponse(500, { error: membershipInsertError.message || 'Unable to add tenant membership' });
    }
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
      const { error: updateError } = await adminClient
        .from('user_roles')
        .update({ role_id: roleRow.id })
        .eq('user_id', userId);
      if (updateError) {
        return jsonResponse(500, { error: updateError.message || 'Unable to update role' });
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

  const { data: existingProfile, error: profileLookupError } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileLookupError && profileLookupError.code !== 'PGRST116') {
    return jsonResponse(500, { error: 'User profile lookup failed' });
  }

  if (!existingProfile?.id) {
    const { error: profileInsertError } = await adminClient
      .from('user_profiles')
      .insert({ id: userId, email, is_active: true });
    if (profileInsertError) {
      return jsonResponse(500, { error: profileInsertError.message || 'Unable to create user profile' });
    }
  }

  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email);
  if (resetError) {
    return jsonResponse(500, { error: resetError.message || 'Unable to send password reset' });
  }

  return jsonResponse(200, { user_id: userId, email, tenant_id: tenantId, role_key: roleRow.key });
});
