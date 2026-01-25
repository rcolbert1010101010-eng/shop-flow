import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.41.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

type TemplateRow = {
  id: string;
  name: string | null;
  is_active: boolean | null;
  updated_at: string | null;
  created_at: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
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

  const { data: tenantId, error: tenantError } = await client.rpc('current_tenant_id');
  if (tenantError || !tenantId) {
    return jsonResponse(403, { error: tenantError?.message ?? 'Tenant not found' });
  }

  const { data: templates, error: templatesError } = await client
    .from('manufacturing_templates')
    .select('id,name,is_active,updated_at,created_at')
    .eq('tenant_id', tenantId);

  if (templatesError) {
    return jsonResponse(500, { error: templatesError.message ?? 'Unable to load templates' });
  }

  const rows = (templates ?? []) as TemplateRow[];

  const { data: versions, error: versionsError } = await client
    .from('manufacturing_template_versions')
    .select('template_id,version_number')
    .eq('tenant_id', tenantId)
    .eq('is_current', true);

  if (versionsError) {
    return jsonResponse(500, { error: versionsError.message ?? 'Unable to load template versions' });
  }

  const versionByTemplate = new Map<string, number | null>();
  (versions ?? []).forEach((row: { template_id?: string | null; version_number?: number | null }) => {
    if (row.template_id) {
      versionByTemplate.set(row.template_id, row.version_number ?? null);
    }
  });

  const payload = rows.map((row) => ({
    id: row.id,
    name: row.name ?? null,
    is_active: row.is_active ?? true,
    updated_at: row.updated_at ?? row.created_at ?? null,
    current_version_number: versionByTemplate.get(row.id) ?? null,
  }));

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: corsHeaders,
  });
});
