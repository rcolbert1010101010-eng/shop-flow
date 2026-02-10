import { supabase } from '@/integrations/supabase/client';

export type UserRow = {
  tenant_id?: string | null;
  user_id: string;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
  role_key?: string | null;
  membership_role?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

export type InviteUserResponse = {
  user_id: string;
  email: string;
  tenant_id: string;
  role_key: string;
};

export type UpdateRoleResponse = {
  user_id: string;
  role_key: string;
};

export type ToggleActiveResponse = {
  user_id: string;
  is_active: boolean;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function getTenantIdOrThrow() {
  const { data: tenantData, error: tenantError } = await supabase.rpc('current_tenant_id');
  if (tenantError) {
    throw new Error(tenantError.message || 'No active tenant selected.');
  }
  const tenantId = (tenantData ?? '').toString().trim();
  if (!tenantId || !isUuid(tenantId)) {
    throw new Error('Invalid tenant id; expected UUID');
  }
  return tenantId;
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

async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message || 'Edge function error');
  }
  return data as T;
}

export async function listUsers(): Promise<UserRow[]> {
  const { data: tenantId, error: tenantError } = await supabase.rpc('current_tenant_id');
  if (tenantError) {
    throw new Error(tenantError.message || 'No active tenant selected');
  }
  if (!tenantId) {
    throw new Error('No active tenant selected');
  }

  const { data, error } = await supabase
    .from('tenant_user_directory_v')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UserRow[];
}

export async function updateUserRole(payload: {
  tenant_id: string;
  user_id: string;
  role_key: string;
}): Promise<UpdateRoleResponse> {
  const tenant_id = (payload.tenant_id ?? '').toString().trim();
  const user_id = (payload.user_id ?? '').toString().trim();
  const role_key = (payload.role_key ?? '').toString().trim().toLowerCase();
  if (!isUuid(tenant_id)) {
    throw new Error('Invalid tenant id; expected UUID');
  }
  if (!isUuid(user_id)) {
    throw new Error('Invalid user id; expected UUID');
  }
  if (!role_key) {
    throw new Error('Role key is required');
  }
  return await invokeEdge<UpdateRoleResponse>('users-update-role', {
    tenant_id,
    user_id,
    role_key,
  });
}

export async function toggleUserActive(payload: {
  user_id: string;
  is_active: boolean;
}): Promise<ToggleActiveResponse> {
  const user_id = (payload.user_id ?? '').toString().trim();
  if (!isUuid(user_id)) {
    throw new Error('Invalid user id; expected UUID');
  }
  if (typeof payload.is_active !== 'boolean') {
    throw new Error('is_active must be boolean');
  }
  return await invokeEdge<ToggleActiveResponse>('users-toggle-active', {
    user_id,
    is_active: payload.is_active,
  });
}

export async function inviteUser(payload: {
  tenant_id?: string;
  email?: string;
  role_key?: string;
}): Promise<InviteUserResponse> {
  const email = (payload.email ?? '').toString().trim().toLowerCase();
  const role_key = (payload.role_key ?? '').toString().trim().toLowerCase() || 'technician';
  const tenant_id = payload.tenant_id ?? (await getTenantIdOrThrow());

  if (!email || !email.includes('@')) {
    throw new Error('A valid email is required.');
  }
  if (!isUuid(tenant_id)) {
    throw new Error('Invalid tenant id; expected UUID');
  }

  return await invokeEdge<InviteUserResponse>('users-invite', {
    tenant_id,
    email,
    role_key,
  });
}
