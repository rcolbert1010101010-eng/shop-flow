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

export async function listUsers(): Promise<UserRow[]> {
  const [{ data: profiles, error: profilesError }, { data: userRoles, error: rolesError }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id,email,full_name,is_active,created_at')
      .order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role:roles(key)'),
  ]);

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
  const payload: Partial<UserRow> = {
    full_name: fields.full_name,
    is_active: fields.is_active,
  };
  const { error } = await supabase.from('user_profiles').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setUserRole(userId: string, roleKeyUpper: string) {
  const roleKey = roleKeyUpper.toString().toLowerCase();
  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('key', roleKey)
    .eq('is_active', true)
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);
  if (!roleRow?.id) throw new Error('Role not found or inactive');

  const { error: upsertError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: 'user_id' });
  if (upsertError) throw new Error(upsertError.message);
}

export async function inviteUser(payload: { email: string; role: string; full_name?: string | null }) {
  const { data, error } = await supabase.functions.invoke('admin-invite-user', {
    body: { ...payload, role: payload.role.toString().toUpperCase() },
  });
  if (error) {
    const message = (data as any)?.error || error.message;
    throw new Error(message);
  }
  return data;
}
