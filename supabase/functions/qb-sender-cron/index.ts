// qb-sender-cron: scheduled runner for qb-sender (queue consumer)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOPFLOW_CRON_SECRET, SHOPFLOW_SERVICE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const cronSecret = Deno.env.get('SHOPFLOW_CRON_SECRET')!;
const serviceKey = Deno.env.get('SHOPFLOW_SERVICE_KEY')!;
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-shopflow-cron-secret',
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const provided = req.headers.get('x-shopflow-cron-secret') || '';
    if (!cronSecret || provided !== cronSecret) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    const senderUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/qb-sender`;
    const resp = await fetch(senderUrl, {
      method: 'POST',
      headers: {
        'x-shopflow-service-key': serviceKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'cron' }),
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        ...corsHeaders,
        'content-type': resp.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err: any) {
    console.error('qb-sender-cron error', err?.message || err);
    return new Response('Internal Error', { status: 500, headers: corsHeaders });
  }
});
