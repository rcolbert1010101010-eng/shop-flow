import { supabase } from '@/integrations/supabase/client';

export type ProfileRow = {
  id: string;
  email: string;
  username?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

export type UserRow = ProfileRow;

async function requireAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');
  return accessToken;
}

async function extractEdgeErrorMessage(data: any, error: any): Promise<string> {
  if (data?.error) {
    return `${data.error}${data.details ? `: ${data.details}` : ''}`;
  }

  const response = error?.context?.response;
  if (response) {
    const status = response.status;
    const statusText = response.statusText;
    try {
      const clone = response.clone();
      const raw = await clone.text();
      try {
        const body = JSON.parse(raw);
        if (body?.error) {
          return `${body.error}${body.details ? `: ${body.details}` : ''}`;
        }
      } catch {
        // ignore JSON parse errors
      }
      return `edge_${status}: ${raw || statusText || 'Unknown error'}`;
    } catch {
      // ignore parsing errors and fall back to diagnostic message
    }
  }

  const errorName = error?.name ?? '';
  const errorMessage = error?.message ?? '';
  const keys = Object.getOwnPropertyNames(error ?? {}).join(',');
  const contextKeys = Object.getOwnPropertyNames(error?.context ?? {}).join(',');
  let contextString = '';
  try {
    contextString = JSON.stringify(error?.context ?? null);
  } catch {
    contextString = '';
  }
  return `edge_invoke_failed: name=${errorName} message=${errorMessage} keys=${keys} contextKeys=${contextKeys} context=${contextString}`;
}

export async function listUsers(): Promise<UserRow[]> {
  let membershipRows;
  let membershipsError;
  let profiles;
  let profilesError;
  let userRoles;
  let rolesError;

  try {
    const { data: tenantId, error: tenantError } = await supabase.rpc('current_tenant_id');
    if (tenantError) {
      throw new Error(tenantError.message || 'No active tenant selected');
    }
    if (!tenantId) {
      throw new Error('No active tenant selected');
    }

    // tenant membership controls visibility; RLS enforces tenant isolation
    const membershipResult = await supabase
      .from('tenant_users')
      .select('user_id, created_at')
      .eq('tenant_id', tenantId);
    membershipRows = membershipResult.data;
    membershipsError = membershipResult.error;

    const memberIds = (membershipRows ?? [])
      .map((row: any) => row?.user_id)
      .filter(Boolean);

    if (memberIds.length === 0) {
      return [];
    }

    const [profilesResult, rolesResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id,email,username,full_name,is_active,created_at')
        .in('id', memberIds),
      supabase.from('user_roles').select('user_id, role:roles(key)').in('user_id', memberIds),
    ]);
    profiles = profilesResult.data;
    profilesError = profilesResult.error;
    userRoles = rolesResult.data;
    rolesError = rolesResult.error;
  } catch (err: any) {
    const message = (err?.message || '').toString().toLowerCase();
    if (err?.name === 'AbortError' || message.includes('signal is aborted') || message.includes('aborted')) {
      return [];
    }
    throw err;
  }

  if (membershipsError) throw new Error(membershipsError.message);
  if (profilesError) throw new Error(profilesError.message);
  if (rolesError) throw new Error(rolesError.message);

  const membershipCreatedAtByUser: Record<string, string | null> = {};
  (membershipRows ?? []).forEach((row: any) => {
    if (row?.user_id) {
      membershipCreatedAtByUser[row.user_id] = row?.created_at ?? null;
    }
  });

  const roleByUser: Record<string, string> = {};
  (userRoles ?? []).forEach((row: any) => {
    const roleKey = row?.role?.key ? row.role.key.toString().toUpperCase() : null;
    if (row?.user_id && roleKey) {
      roleByUser[row.user_id] = roleKey;
    }
  });

  const mergedProfiles = (profiles ?? [])
    .map((profile: any) => ({
      ...profile,
      created_at: profile?.created_at ?? membershipCreatedAtByUser[profile?.id] ?? null,
    }))
    .filter((row: any) => row?.id);

  const sortedProfiles = mergedProfiles.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return sortedProfiles.map((p) => ({
    ...p,
    role: roleByUser[p.id] ?? 'TECHNICIAN',
  }));
}

export async function updateUserProfile(id: string, fields: Partial<UserRow>) {
  const payload: Partial<UserRow> = {
    full_name: fields.full_name,
    is_active: fields.is_active,
  };
  throw new Error(
    [
      'Browser admin-update-user is disabled.',
      `user_id="${id}" action="update_profile" payload=${JSON.stringify(payload)}`,
      'Use Supabase Dashboard or SQL to modify role/active status/tenant membership for now.',
      'Future fix: move to server-side /api/admin/users endpoint.',
    ].join(' '),
  );
}

export async function setUserRole(userId: string, roleKeyUpper: string) {
  throw new Error(
    [
      'Browser admin-update-user is disabled.',
      `user_id="${userId}" action="set_role" role="${(roleKeyUpper ?? '').toString().trim().toUpperCase() || 'n/a'}"`,
      'Use Supabase Dashboard or SQL to modify role/active status/tenant membership for now.',
      'Future fix: move to server-side /api/admin/users endpoint.',
    ].join(' '),
  );
}

export async function removeUserFromTenant(userId: string) {
  throw new Error(
    [
      'Browser admin-update-user is disabled.',
      `user_id="${userId}" action="remove_tenant_membership"`,
      'Use Supabase Dashboard or SQL to modify role/active status/tenant membership for now.',
      'Future fix: move to server-side /api/admin/users endpoint.',
    ].join(' '),
  );
}

export async function createUser(payload: {
  email?: string;
  username?: string;
  password?: string;
  role: string;
  full_name?: string | null;
}) {
  const email = (payload.email ?? '').toString().trim().toLowerCase();
  const username = (payload.username ?? '').toString().trim();
  const role = (payload.role ?? '').toString().trim().toUpperCase() || 'TECHNICIAN';
  const emailTemplate = 'node tools/admin/create-user.mjs --email "<email>" --tenant "<tenant_uuid>" --role "<role>" --send-invite';
  const usernameTemplate =
    'AUTH_EMAIL_DOMAIN="shopflow.local" node tools/admin/create-user.mjs --username "<username>" --tenant "<tenant_uuid>" --role "<role>" --send-invite';
  const suggestedCommand = email
    ? `node tools/admin/create-user.mjs --email "${email}" --tenant "<tenant_uuid>" --role "${role}" --send-invite`
    : username
      ? `AUTH_EMAIL_DOMAIN="shopflow.local" node tools/admin/create-user.mjs --username "${username}" --tenant "<tenant_uuid>" --role "${role}" --send-invite`
      : `node tools/admin/create-user.mjs --email "<email>" --tenant "<tenant_uuid>" --role "${role}" --send-invite`;

  throw new Error(
    [
      'Browser admin-create-user is disabled.',
      `Email template: ${emailTemplate}`,
      `Username template: ${usernameTemplate}`,
      `Suggested with current values: ${suggestedCommand}`,
      'Paste the target tenant UUID in place of "<tenant_uuid>" (do not leave placeholder).',
      `Provided payload: email="${email || 'n/a'}", username="${username || 'n/a'}", role="${role}"`,
    ].join(' '),
  );
}
