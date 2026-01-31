import { supabase } from '@/integrations/supabase/client';

export type ProfileRow = {
  id: string;
  email: string;
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
    try {
      const contentType = response?.headers?.get?.('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await response.json();
        if (body?.error) {
          return `${body.error}${body.details ? `: ${body.details}` : ''}`;
        }
        if (body?.message) return body.message;
      } else {
        const text = await response.text();
        if (text) return text;
      }
    } catch {
      // ignore parse errors and fall back to generic message
    }
  }

  return error?.message || 'Unknown error';
}

export async function listUsers(): Promise<UserRow[]> {
  let membershipRows;
  let membershipsError;
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
      .select('user_id, created_at, user_profiles!inner(id,email,full_name,is_active,created_at)')
      .eq('tenant_id', tenantId);
    membershipRows = membershipResult.data;
    membershipsError = membershipResult.error;

    const memberIds = (membershipRows ?? [])
      .map((row: any) => row?.user_profiles?.id ?? row?.user_id)
      .filter(Boolean);

    if (memberIds.length > 0) {
      const rolesResult = await supabase
        .from('user_roles')
        .select('user_id, role:roles(key)')
        .in('user_id', memberIds);
      userRoles = rolesResult.data;
      rolesError = rolesResult.error;
    } else {
      userRoles = [];
      rolesError = null;
    }
  } catch (err: any) {
    const message = (err?.message || '').toString().toLowerCase();
    if (err?.name === 'AbortError' || message.includes('signal is aborted') || message.includes('aborted')) {
      return [];
    }
    throw err;
  }

  if (membershipsError) throw new Error(membershipsError.message);
  if (rolesError) throw new Error(rolesError.message);

  const profiles = (membershipRows ?? [])
    .map((row: any) => {
      const profile = row?.user_profiles ?? {};
      return {
        id: profile.id ?? row?.user_id,
        email: profile.email ?? '',
        full_name: profile.full_name ?? null,
        is_active: profile.is_active ?? null,
        created_at: profile.created_at ?? row?.created_at ?? null,
      } as UserRow;
    })
    .filter((row: any) => row?.id);

  const roleByUser: Record<string, string> = {};
  (userRoles ?? []).forEach((row: any) => {
    const roleKey = row?.role?.key ? row.role.key.toString().toUpperCase() : null;
    if (row?.user_id && roleKey) {
      roleByUser[row.user_id] = roleKey;
    }
  });

  const sortedProfiles = profiles.sort((a, b) => {
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
  const accessToken = await requireAccessToken();
  const payload: Partial<UserRow> = {
    full_name: fields.full_name,
    is_active: fields.is_active,
  };
  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { user_id: id, ...payload },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message);
  }
}

export async function setUserRole(userId: string, roleKeyUpper: string) {
  const accessToken = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { user_id: userId, role: roleKeyUpper },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message);
  }
}

export async function removeUserFromTenant(userId: string) {
  const accessToken = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { user_id: userId, action: 'remove' },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message);
  }
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: string;
  full_name?: string | null;
}) {
  const accessToken = await requireAccessToken();

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { ...payload, role: payload.role.toString().toUpperCase() },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message);
  }
  return data;
}
