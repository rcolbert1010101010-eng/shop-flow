import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.41.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type DraftPayload = {
  templateId?: string;
  materialSpec?: Record<string, unknown>;
  materialGroups?: unknown[];
  operations?: unknown[];
};

serve(async (req) => {
  if (req.method !== 'PUT') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let payload: DraftPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const templateId = typeof payload.templateId === 'string' ? payload.templateId.trim() : '';
  const materialSpec = payload.materialSpec ?? null;
  const materialGroups = payload.materialGroups ?? null;
  const operations = payload.operations ?? null;

  if (!templateId) {
    return jsonResponse(400, { error: 'templateId is required' });
  }
  if (!materialSpec || typeof materialSpec !== 'object' || Array.isArray(materialSpec)) {
    return jsonResponse(400, { error: 'materialSpec must be an object' });
  }
  if (!Array.isArray(materialGroups)) {
    return jsonResponse(400, { error: 'materialGroups must be an array' });
  }
  if (!Array.isArray(operations)) {
    return jsonResponse(400, { error: 'operations must be an array' });
  }

  const { data: tenantId, error: tenantError } = await client.rpc('current_tenant_id');
  if (tenantError || !tenantId) {
    return jsonResponse(403, { error: tenantError?.message ?? 'Tenant not found' });
  }

  const { data: updated, error: updateError } = await client
    .from('manufacturing_templates')
    .update({
      draft_json: {
        materialSpec,
        materialGroups,
        operations,
      },
    })
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    return jsonResponse(500, { error: updateError.message ?? 'Unable to save draft' });
  }

  if (!updated?.id) {
    return jsonResponse(404, { error: 'Template not found' });
  }

  return jsonResponse(200, { ok: true });
});
