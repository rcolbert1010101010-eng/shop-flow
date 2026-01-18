// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.41.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: authUser, error: authError } = await callerClient.auth.getUser();
  if (authError || !authUser?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_admin', {
    uid: authUser.user.id,
  });

  if (adminCheckError || !isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = (payload?.email ?? '').toString().trim().toLowerCase();
  const full_name = (payload?.full_name ?? '').toString().trim();
  const role_key = (payload?.role_key ?? '').toString().trim();

  if (!email || !role_key) {
    return new Response(JSON.stringify({ error: 'email and role_key are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: roleRow, error: roleError } = await adminClient
    .from('roles')
    .select('id')
    .eq('key', role_key)
    .eq('is_active', true)
    .maybeSingle();

  if (roleError || !roleRow?.id) {
    return new Response(JSON.stringify({ error: 'Invalid or inactive role' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  });

  if (inviteError || !inviteData?.user?.id) {
    return new Response(JSON.stringify({ error: inviteError?.message ?? 'Failed to create user' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = inviteData.user.id;

  const { error: profileError } = await adminClient
    .from('user_profiles')
    .upsert({
      id: userId,
      email,
      full_name: full_name || null,
      is_active: true,
    });

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message ?? 'Failed to upsert profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: roleAssignError } = await adminClient
    .from('user_roles')
    .upsert({
      user_id: userId,
      role_id: roleRow.id,
    });

  if (roleAssignError) {
    return new Response(JSON.stringify({ error: roleAssignError.message ?? 'Failed to assign role' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      user_id: userId,
      email,
      role_key,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
