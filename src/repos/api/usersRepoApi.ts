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

export async function listUsers(): Promise<UserRow[]> {
  let profiles;
  let profilesError;
  let userRoles;
  let rolesError;

  try {
    [
      { data: profiles, error: profilesError },
      { data: userRoles, error: rolesError },
    ] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id,email,full_name,is_active,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role:roles(key)'),
    ]);
  } catch (err: any) {
    const message = (err?.message || '').toString().toLowerCase();
    if (err?.name === 'AbortError' || message.includes('signal is aborted') || message.includes('aborted')) {
      return [];
    }
    throw err;
  }

  if (profilesError) throw new Error(profilesError.message);
  if (rolesError) throw new Error(rolesError.message);

  const roleByUser: Record<string, string> = {};
  (userRoles ?? []).forEach((row: any) => {
    const roleKey = row?.role?.key ? row.role.key.toString().toUpperCase() : null;
    if (row?.user_id && roleKey) {
      roleByUser[row.user_id] = roleKey;
    }
  });

  return (profiles ?? []).map((p) => ({
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
    const message = (data as any)?.error || error.message;
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
    const message = (data as any)?.error || error.message;
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
    const message = (data as any)?.error || error.message;
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
    const message = (data as any)?.error || error.message;
    throw new Error(message);
  }
  return data;
}
