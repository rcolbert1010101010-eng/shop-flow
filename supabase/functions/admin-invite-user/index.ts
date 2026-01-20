// Admin invite user via Supabase Admin API
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.41.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const allowedRoles = new Set([
  'ADMIN',
  'MANAGER',
  'SERVICE_WRITER',
  'TECHNICIAN',
  'PARTS_MANAGER',
  'SALES_COUNTER',
  'GUEST',
]);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
}

serve(async (req) => {
  if (req.method !== 'POST') {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Caller client for auth + role check (uses anon key with caller token)
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  // Service-role client for privileged actions
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: authUser, error: authError } = await caller.auth.getUser();
  if (authError || !authUser?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const { data: appRole, error: roleError } = await caller.rpc('current_app_role');
  if (roleError || appRole !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const email = (payload?.email ?? '').toString().trim().toLowerCase();
  const role = (payload?.role ?? '').toString().trim().toUpperCase();
  const full_name = (payload?.full_name ?? '').toString().trim() || null;

  if (!email || !role) {
    return new Response(JSON.stringify({ error: 'email and role are required' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!allowedRoles.has(role)) {
    return new Response(JSON.stringify({ error: 'Invalid role' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name } });
  if (inviteError || !invite?.user?.id) {
    return new Response(JSON.stringify({ error: inviteError?.message ?? 'Invite failed' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const userId = invite.user.id;

  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name,
        is_active: true,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message ?? 'Profile upsert failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const { data: roleRow, error: roleLookupError } = await admin
    .from('roles')
    .select('id')
    .eq('key', role.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  if (roleLookupError || !roleRow?.id) {
    return new Response(JSON.stringify({ error: roleLookupError?.message ?? 'Role not found or inactive' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { error: userRoleError } = await admin
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: 'user_id' });
  if (userRoleError) {
    return new Response(JSON.stringify({ error: userRoleError.message ?? 'Role assignment failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ ok: true, user_id: userId, email }), {
    status: 200,
    headers: corsHeaders,
  });
});
