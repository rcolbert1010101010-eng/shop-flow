// Admin update user via Supabase Admin API
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

const adminTenantRoles = new Set(['owner', 'admin', 'manager']);

serve(async (req) => {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return new Response(
        JSON.stringify({
          error: 'missing_env',
          details: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY',
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    if (req.method !== 'POST') {
      if (req.method === 'OPTIONS') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'missing_authorization' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'missing_authorization' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await sbAdmin.auth.getUser(token);
    const caller = authData?.user;
    if (authError || !caller) {
      return new Response(
        JSON.stringify({
          error: 'invalid_token',
          details: authError?.message ?? null,
        }),
        {
          status: 401,
          headers: corsHeaders,
        },
      );
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const userId = (payload?.user_id ?? '').toString().trim();
    const full_name = payload?.full_name ?? undefined;
    const is_active = payload?.is_active ?? undefined;
    const role = payload?.role ? payload.role.toString().trim().toUpperCase() : undefined;
    const action = payload?.action ? payload.action.toString().trim().toLowerCase() : undefined;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id_required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    let tenantId: string | null = null;
    let callerTenantRole: string | null = null;

    const { data: profileRow, error: profileError } = await sbAdmin
      .from('profiles')
      .select('active_tenant_id')
      .eq('id', caller.id)
      .maybeSingle();

    if (
      profileError &&
      profileError.code !== 'PGRST116' &&
      !/does not exist/i.test(profileError.message ?? '') &&
      profileError.code !== '42P01'
    ) {
      return new Response(
        JSON.stringify({ error: 'tenant_lookup_failed', details: profileError.message }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    if (profileRow?.active_tenant_id) {
      tenantId = profileRow.active_tenant_id;
      const { data: membershipRow, error: membershipError } = await sbAdmin
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('user_id', caller.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (membershipError) {
        return new Response(
          JSON.stringify({ error: 'tenant_lookup_failed', details: membershipError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
      if (!membershipRow?.tenant_id) {
        return new Response(
          JSON.stringify({ error: 'forbidden', details: 'not_tenant_member' }),
          {
            status: 403,
            headers: corsHeaders,
          },
        );
      }
      callerTenantRole = membershipRow?.role ?? null;
    } else {
      const { data: membershipRow, error: membershipError } = await sbAdmin
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('user_id', caller.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (membershipError) {
        return new Response(
          JSON.stringify({ error: 'tenant_lookup_failed', details: membershipError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
      tenantId = membershipRow?.tenant_id ?? null;
      callerTenantRole = membershipRow?.role ?? null;
    }

    const normalizedTenantRole = (callerTenantRole ?? '').toString().toLowerCase();
    if (!tenantId || !adminTenantRoles.has(normalizedTenantRole)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (action === 'remove') {
      const { error: deactivateError } = await sbAdmin
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);
      if (deactivateError) {
        return new Response(
          JSON.stringify({ error: 'user_profile_update_failed', details: deactivateError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }

      const { error: membershipDeleteError } = await sbAdmin
        .from('tenant_users')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
      if (membershipDeleteError) {
        return new Response(
          JSON.stringify({ error: 'tenant_membership_remove_failed', details: membershipDeleteError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (full_name !== undefined || is_active !== undefined) {
      const updatePayload: Record<string, any> = {};
      if (full_name !== undefined) updatePayload.full_name = full_name;
      if (is_active !== undefined) updatePayload.is_active = is_active;

      const { error: profileUpdateError } = await sbAdmin
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', userId);
      if (profileUpdateError) {
        return new Response(
          JSON.stringify({ error: 'user_profile_update_failed', details: profileUpdateError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
    }

    if (role) {
      const roleKey = role.toLowerCase();
      const { data: roleRow, error: roleLookupError } = await sbAdmin
        .from('roles')
        .select('id')
        .eq('key', roleKey)
        .eq('is_active', true)
        .maybeSingle();
      if (roleLookupError || !roleRow?.id) {
        return new Response(
          JSON.stringify({
            error: 'role_not_found',
            details: roleLookupError?.message ?? 'Role not found',
          }),
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      const { error: userRoleError } = await sbAdmin
        .from('user_roles')
        .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: 'user_id' });
      if (userRoleError) {
        return new Response(
          JSON.stringify({ error: 'role_assignment_failed', details: userRoleError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Unknown error' }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
