import { supabase } from '@/integrations/supabase/client';

export type UserRow = {
  tenant_id?: string | null;
  id?: string | null;
  user_id?: string | null;
  email?: string | null;
  username?: string | null;
  full_name?: string | null;
  role_key?: string | null;
  membership_role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  can_remove_from_tenant?: boolean;
  remove_disabled_reason?: string | null;
};

export type UpdateRoleResponse = {
  user_id: string;
  role_key: string;
};

const ADMIN_API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? '/api/v1';
const ADMIN_API_KEY = import.meta.env.VITE_SHOPFLOW_ADMIN_API_KEY ?? '';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

export async function listUsers(tenantId: string, actorUserId?: string): Promise<UserRow[]> {
  if (!ADMIN_API_KEY) {
    throw new Error('Missing VITE_SHOPFLOW_ADMIN_API_KEY');
  }
  const normalizedTenantId = String(tenantId || '').trim();
  if (!isUuid(normalizedTenantId)) {
    throw new Error('No active tenant selected');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Tenant-Id': normalizedTenantId,
    'x-shopflow-admin-key': ADMIN_API_KEY,
  };
  if (actorUserId && isUuid(String(actorUserId))) {
    headers['x-actor-user-id'] = String(actorUserId);
  }

  const response = await fetch(`${ADMIN_API_BASE_URL}/admin/users`, {
    method: 'GET',
    headers,
  });

  const rawText = await response.text();
  let data: any = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      rawText ||
      response.statusText ||
      'Failed to load users';
    throw new Error(String(message));
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    ...(row as UserRow),
    id: row?.id ? String(row.id) : row?.user_id ? String(row.user_id) : null,
    user_id: row?.user_id ? String(row.user_id) : row?.id ? String(row.id) : null,
    updated_at: row?.updated_at ? String(row.updated_at) : null,
    can_remove_from_tenant:
      typeof row?.can_remove_from_tenant === 'boolean' ? row.can_remove_from_tenant : undefined,
    remove_disabled_reason: row?.remove_disabled_reason ? String(row.remove_disabled_reason) : null,
  })) as UserRow[];
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
