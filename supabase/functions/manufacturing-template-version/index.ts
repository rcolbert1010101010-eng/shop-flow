import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.41.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const forbiddenKeys = new Set(['inventory', 'nesting', 'scheduling']);

const hasForbiddenKeys = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenKeys(entry));
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (forbiddenKeys.has(key)) return true;
    if (hasForbiddenKeys(record[key])) return true;
  }
  return false;
};

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
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

  let payload: { template_id?: string; notes?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const templateId = typeof payload.template_id === 'string' ? payload.template_id.trim() : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : null;

  if (!templateId || !uuidPattern.test(templateId)) {
    return jsonResponse(400, { error: 'template_id is required' });
  }

  const { data: tenantId, error: tenantError } = await client.rpc('current_tenant_id');
  if (tenantError || !tenantId) {
    return jsonResponse(403, { error: tenantError?.message ?? 'Tenant not found' });
  }

  const { data: templateRow, error: templateError } = await client
    .from('manufacturing_templates')
    .select('id,draft_json')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (templateError) {
    return jsonResponse(500, { error: templateError.message ?? 'Unable to load template' });
  }

  if (!templateRow?.id) {
    return jsonResponse(404, { error: 'Template not found' });
  }

  const draft = templateRow.draft_json;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return jsonResponse(400, { error: 'draft_json must be an object' });
  }

  if (hasForbiddenKeys(draft)) {
    return jsonResponse(400, { error: 'draft_json contains forbidden keys' });
  }

  const materialSpec = (draft as Record<string, unknown>).materialSpec;
  if (!materialSpec || typeof materialSpec !== 'object' || Array.isArray(materialSpec)) {
    return jsonResponse(400, { error: 'materialSpec must be an object' });
  }

  const operations = (draft as Record<string, unknown>).operations;
  if (!Array.isArray(operations) || operations.length < 1) {
    return jsonResponse(400, { error: 'operations must be a non-empty array' });
  }

  for (const operation of operations) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      return jsonResponse(400, { error: 'operations entries must be objects' });
    }
    const op = operation as Record<string, unknown>;
    if (!isNonEmptyString(op.name)) {
      return jsonResponse(400, { error: 'operations.name is required' });
    }
    const hours = typeof op.estimated_hours === 'number' ? op.estimated_hours : Number(op.estimated_hours);
    if (!Number.isFinite(hours) || hours < 0) {
      return jsonResponse(400, { error: 'operations.estimated_hours must be >= 0' });
    }
    if (!isNonEmptyString(op.skill_type)) {
      return jsonResponse(400, { error: 'operations.skill_type is required' });
    }
    if (!isNonEmptyString(op.machine_type)) {
      return jsonResponse(400, { error: 'operations.machine_type is required' });
    }
  }

  const { data: rpcData, error: rpcError } = await client.rpc('manufacturing_create_template_version', {
    p_template_id: templateId,
    p_notes: notes,
  });

  if (rpcError) {
    const message = rpcError.message ?? 'Unable to create template version';
    const status = message.toLowerCase().includes('not found')
      ? 404
      : message.toLowerCase().includes('draft') || message.toLowerCase().includes('material')
        ? 400
        : 500;
    return jsonResponse(status, { error: message });
  }

  const resultRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const templateVersionId = resultRow?.template_version_id ?? resultRow?.id;
  const versionNumber = resultRow?.version_number ?? resultRow?.versionNumber;

  return jsonResponse(200, {
    template_id: templateId,
    template_version_id: templateVersionId,
    version_number: versionNumber,
    is_current: true,
  });
});
