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

  let payload: { user_id?: string; is_active?: unknown } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const userId = typeof payload.user_id === 'string' ? payload.user_id.trim() : '';
  const isActive = payload.is_active;

  if (!userId) {
    return jsonResponse(400, { error: 'user_id is required' });
  }
  if (!isUuid(userId)) {
    return jsonResponse(400, { error: 'user_id must be a UUID' });
  }
  if (typeof isActive !== 'boolean') {
    return jsonResponse(400, { error: 'is_active must be a boolean' });
  }

  const { data: isAdmin, error: isAdminError } = await callerClient.rpc('is_admin', { uid: caller.id });
  if (isAdminError) {
    return jsonResponse(500, { error: 'Admin check failed' });
  }
  if (!isAdmin) {
    return jsonResponse(403, { error: 'not_admin' });
  }

  const { error: updateError } = await adminClient
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (updateError) {
    return jsonResponse(500, { error: updateError.message || 'Unable to update user status' });
  }

  return jsonResponse(200, { user_id: userId, is_active: isActive });
};

serve(handler);
