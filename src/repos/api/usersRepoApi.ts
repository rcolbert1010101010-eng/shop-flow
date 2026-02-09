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

export type InviteUserResponse = {
  ok: boolean;
  user_id: string;
  email: string;
  tenant_id: string;
  role_key_effective: string;
  invited: boolean;
  created: boolean;
  rid?: string;
  temp_password?: string | null;
};

export type UserLifecycleResponse = {
  ok: boolean;
  user_id: string;
  tenant_id: string;
  action: 'deactivate' | 'reactivate';
  changed: boolean;
  already_in_state: boolean;
  rid?: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function getAdminRequestContext() {
  const adminApiKey = (import.meta.env.VITE_SHOPFLOW_ADMIN_API_KEY ?? '').toString().trim();
  const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').toString().replace(/\/+$/, '');

  const { data: tenantData, error: tenantError } = await supabase.rpc('current_tenant_id');
  if (tenantError) {
    throw new Error(tenantError.message || 'No active tenant selected.');
  }
  const tenantId = (tenantData ?? '').toString().trim();

  if (!tenantId || !isUuid(tenantId)) {
    throw new Error('Invalid tenant id; expected UUID');
  }
  if (!adminApiKey) {
    throw new Error('Missing VITE_SHOPFLOW_ADMIN_API_KEY.');
  }

  return { base, adminApiKey, tenantId };
}

async function parseResponseOrThrow(response: Response): Promise<any> {
  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const ridSuffix = data?.rid ? ` [rid=${data.rid}]` : '';
    const errorMessage =
      data?.message ||
      data?.error ||
      raw ||
      `Request failed with status ${response.status}${ridSuffix}`;
    if (ridSuffix && !String(errorMessage).includes('[rid=')) {
      throw new Error(`${errorMessage}${ridSuffix}`);
    }
    throw new Error(errorMessage);
  }

  return data;
}

async function fetchTenantMembershipRows(tenantId: string) {
  const selectCandidates = [
    'user_id, created_at, is_active, active, deactivated_at, disabled_at, deleted_at',
    'user_id, created_at, deactivated_at',
    'user_id, created_at, is_active',
    'user_id, created_at',
  ];

  let lastResult: { data: any; error: any } = { data: null, error: null };
  for (const selectClause of selectCandidates) {
    const result = await supabase.from('tenant_users').select(selectClause).eq('tenant_id', tenantId);
    lastResult = result;
    if (!result.error) {
      return result;
    }

    const message = String(result.error.message || '').toLowerCase();
    const isMissingColumnError =
      message.includes('could not find') && message.includes('column') && message.includes('schema cache');
    if (!isMissingColumnError) {
      return result;
    }
  }

  return lastResult;
}

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
    const membershipResult = await fetchTenantMembershipRows(tenantId);
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
  const membershipActiveByUser: Record<string, boolean> = {};
  (membershipRows ?? []).forEach((row: any) => {
    if (row?.user_id) {
      membershipCreatedAtByUser[row.user_id] = row?.created_at ?? null;
      let isActive = true;
      if (Object.prototype.hasOwnProperty.call(row, 'is_active')) {
        isActive = row?.is_active !== false;
      } else if (Object.prototype.hasOwnProperty.call(row, 'active')) {
        isActive = row?.active !== false;
      } else if (Object.prototype.hasOwnProperty.call(row, 'deactivated_at')) {
        isActive = !row?.deactivated_at;
      } else if (Object.prototype.hasOwnProperty.call(row, 'disabled_at')) {
        isActive = !row?.disabled_at;
      } else if (Object.prototype.hasOwnProperty.call(row, 'deleted_at')) {
        isActive = !row?.deleted_at;
      }
      membershipActiveByUser[row.user_id] = isActive;
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
      is_active: membershipActiveByUser[profile?.id] ?? profile?.is_active ?? true,
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
  return deactivateUser(userId);
}

export async function createUser(payload: {
  email?: string;
  username?: string;
  password?: string;
  role: string;
  full_name?: string | null;
}) {
  return inviteUser({
    email: payload.email,
    role_key: payload.role,
    full_name: payload.full_name,
  });
}

export async function inviteUser(payload: {
  email?: string;
  role_key?: string;
  full_name?: string | null;
}): Promise<InviteUserResponse> {
  const email = (payload.email ?? '').toString().trim().toLowerCase();
  const role_key = (payload.role_key ?? '').toString().trim().toUpperCase() || 'TECHNICIAN';
  const full_name = payload.full_name?.toString().trim() || undefined;
  const { base, adminApiKey, tenantId } = await getAdminRequestContext();

  if (!email || !email.includes('@')) {
    throw new Error('A valid email is required.');
  }
  if (!tenantId || !isUuid(tenantId)) {
    throw new Error('Invalid tenant id; expected UUID');
  }
  if (!adminApiKey) {
    throw new Error('Missing VITE_SHOPFLOW_ADMIN_API_KEY.');
  }
  if (import.meta.env.DEV) {
    console.info('INVITE_USER_TENANT', { tenantId });
  }

  const response = await fetch(`${base}/api/v1/admin/users/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shopflow-admin-key': adminApiKey,
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({
      email,
      role_key,
      full_name,
    }),
  });
  return (await parseResponseOrThrow(response)) as InviteUserResponse;
}

export async function deactivateUser(userId: string): Promise<UserLifecycleResponse> {
  const normalizedUserId = (userId ?? '').toString().trim();
  if (!isUuid(normalizedUserId)) {
    throw new Error('Invalid user id; expected UUID');
  }
  const { base, adminApiKey, tenantId } = await getAdminRequestContext();
  const response = await fetch(`${base}/api/v1/admin/users/${normalizedUserId}/deactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shopflow-admin-key': adminApiKey,
      'X-Tenant-Id': tenantId,
    },
  });
  return (await parseResponseOrThrow(response)) as UserLifecycleResponse;
}

export async function reactivateUser(userId: string): Promise<UserLifecycleResponse> {
  const normalizedUserId = (userId ?? '').toString().trim();
  if (!isUuid(normalizedUserId)) {
    throw new Error('Invalid user id; expected UUID');
  }
  const { base, adminApiKey, tenantId } = await getAdminRequestContext();
  const response = await fetch(`${base}/api/v1/admin/users/${normalizedUserId}/reactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shopflow-admin-key': adminApiKey,
      'X-Tenant-Id': tenantId,
    },
  });
  return (await parseResponseOrThrow(response)) as UserLifecycleResponse;
}
