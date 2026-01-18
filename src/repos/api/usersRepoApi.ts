import { supabase } from '@/integrations/supabase/client';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role_key: string | null;
  role_name?: string | null;
};

export type AdminRole = {
  key: string;
  name: string;
  description: string | null;
};

const mapUserRow = (row: any): AdminUser => {
  const roleRelation = Array.isArray(row.user_roles) ? row.user_roles[0] : row.user_roles;
  const role = roleRelation?.roles ?? roleRelation?.role ?? {};

  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name ?? null,
    is_active: row.is_active ?? true,
    role_key: role?.key ?? null,
    role_name: role?.name ?? null,
  };
};

export async function listRoles(): Promise<AdminRole[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('roles')
    .select('key, name, description')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching roles', error);
    throw new Error(error.message ?? 'Failed to fetch roles');
  }

  return data?.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description ?? null,
  })) ?? [];
}

export async function listUsers(): Promise<AdminUser[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, is_active, user_roles(role_id, roles(key, name))')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users', error);
    throw new Error(error.message ?? 'Failed to fetch users');
  }

  return (data ?? []).map(mapUserRow);
}

export async function assignRole(userId: string, roleKey: string): Promise<void> {
  if (!supabase) return;

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('key', roleKey)
    .eq('is_active', true)
    .maybeSingle();

  if (roleError || !role?.id) {
    throw new Error(roleError?.message ?? 'Role not found or inactive');
  }

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: role.id });

  if (error) {
    console.error('Error assigning role', error);
    throw new Error(error.message ?? 'Failed to assign role');
  }
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user active state', error);
    throw new Error(error.message ?? 'Failed to update user');
  }
}

export async function createUser(payload: { email: string; full_name?: string; role_key: string }): Promise<{
  user_id: string;
  email: string;
  role_key: string;
}> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: payload,
  });

  if (error) {
    console.error('Error creating user via function', error);
    throw new Error(error.message ?? 'Failed to create user');
  }

  return data as { user_id: string; email: string; role_key: string };
}
