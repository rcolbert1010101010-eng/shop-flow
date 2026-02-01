// Admin create user via Supabase Admin API (username/password)
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

const normalizeUsername = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');

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

    const usernameRaw = (payload?.username ?? '').toString();
    const usernameNormalized = normalizeUsername(usernameRaw);
    const password = (payload?.password ?? '').toString();
    const role = (payload?.role ?? '').toString().trim().toUpperCase();
    const full_name = (payload?.full_name ?? '').toString().trim() || null;
    const email = `${usernameNormalized}@local.shopflow`;

    console.log('create user called', {
      hasAuthHeader: !!authHeader,
      username_raw: usernameRaw,
      username_normalized: usernameNormalized,
    });

    if (!usernameNormalized || !password || !role) {
      return new Response(JSON.stringify({ error: 'username_password_role_required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const rawLower = usernameRaw.trim().toLowerCase();
    if (!usernameNormalized || usernameNormalized !== rawLower) {
      return new Response(
        JSON.stringify({
          error: 'invalid_username',
          details: 'Username must be letters/numbers and ._- only (no spaces)',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (!allowedRoles.has(role)) {
      return new Response(JSON.stringify({ error: 'invalid_role' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const adminTenantRoles = new Set(['owner', 'admin', 'manager']);
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

    let emailUsed = email;
    const { data: usernameMatch, error: usernameMatchError } = await sbAdmin
      .from('user_profiles')
      .select('id,email,username')
      .eq('username', usernameNormalized)
      .maybeSingle();

    if (usernameMatchError) {
      return new Response(
        JSON.stringify({ error: 'username_check_failed', details: usernameMatchError.message }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    let userId = usernameMatch?.id ?? null;
    let reused = false;
    if (userId) {
      reused = true;
      emailUsed = usernameMatch?.email ?? email;
      const { error: updateError } = await sbAdmin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { username: usernameNormalized, full_name },
      });
      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'update_user_failed', details: updateError.message }),
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
    } else {
      const { data: createdUser, error: createError } = await sbAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: usernameNormalized, full_name },
      });
      userId = createdUser?.user?.id ?? null;
      if (createError || !userId) {
        const message = createError?.message ?? 'Create user failed';
        if (/already been registered|already exists|duplicate/i.test(message)) {
          let existingUserId: string | null = null;
          for (let page = 1; page <= 20; page += 1) {
            const { data: usersPage, error: listError } = await sbAdmin.auth.admin.listUsers({
              page,
              perPage: 1000,
            });
            if (listError) {
              return new Response(
                JSON.stringify({ error: 'create_user_failed', details: listError.message }),
                {
                  status: 500,
                  headers: corsHeaders,
                },
              );
            }
            const users = usersPage?.users ?? [];
            if (users.length === 0) break;
            const match = users.find((u) => (u?.email ?? '').toLowerCase() === email.toLowerCase());
            if (match?.id) {
              existingUserId = match.id;
              break;
            }
          }

          if (!existingUserId) {
            return new Response(
              JSON.stringify({ error: 'create_user_failed', details: message }),
              {
                status: 400,
                headers: corsHeaders,
              },
            );
          }

          const { error: updateError } = await sbAdmin.auth.admin.updateUserById(existingUserId, {
            password,
            user_metadata: { username: usernameNormalized, full_name },
          });
          if (updateError) {
            return new Response(
              JSON.stringify({ error: 'update_user_failed', details: updateError.message }),
              {
                status: 500,
                headers: corsHeaders,
              },
            );
          }

          userId = existingUserId;
          reused = true;
        } else {
          const status = /already exists|duplicate/i.test(message) ? 409 : 400;
          return new Response(
            JSON.stringify({ error: 'create_user_failed', details: message }),
            {
              status,
              headers: corsHeaders,
            },
          );
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'create_user_failed', details: 'Missing user id' }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const { error: tenantUserError } = await sbAdmin
      .from('tenant_users')
      .upsert(
        { tenant_id: tenantId, user_id: userId, role: role.toLowerCase() },
        { onConflict: 'tenant_id,user_id' },
      );
    if (tenantUserError) {
      return new Response(
        JSON.stringify({ error: 'tenant_membership_failed', details: tenantUserError.message }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const userProfilePayload: Record<string, any> = {
      id: userId,
      email: emailUsed,
      full_name,
      is_active: true,
      username: usernameNormalized,
    };
    const { error: userProfileError } = await sbAdmin
      .from('user_profiles')
      .upsert(userProfilePayload, { onConflict: 'id' });
    if (userProfileError) {
      return new Response(
        JSON.stringify({ error: 'user_profile_upsert_failed', details: userProfileError.message }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const { data: roleRow, error: roleLookupError } = await sbAdmin
      .from('roles')
      .select('id')
      .eq('key', role.toLowerCase())
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

    return new Response(JSON.stringify({ success: true, user_id: userId, reused }), {
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
