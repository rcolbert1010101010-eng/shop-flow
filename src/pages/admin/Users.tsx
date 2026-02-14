// Admins set user passwords at creation time; no temporary passwords are used.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { listUsers, type UserRow } from '@/repos/api/usersRepoApi';

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'service_writer', label: 'Service Writer' },
  { value: 'technician', label: 'Technician' },
];

const createRoleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'technician', label: 'Technician' },
];

const ADMIN_API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const ADMIN_API_KEY = import.meta.env.VITE_SHOPFLOW_ADMIN_API_KEY ?? '';

type CreateUserResponse = {
  user_id: string;
  email: string;
  tenant_id: string;
  role_key: string;
};

type UpdateRoleResponse = {
  user_id: string;
  role_key: string;
};

type RemoveFromTenantResponse = {
  success: boolean;
  removed: boolean;
};

type EdgeErrorInfo = {
  code?: string;
  message: string;
};

type AdminApiErrorPayload = {
  error?: string;
  reason?: string;
  message?: string;
  details?: any;
  context?: any;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuidLike = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return UUID_RE.test(value.trim());
};

const sanitizeDisplayValue = (value: string | null | undefined): string => {
  const next = String(value ?? '').trim();
  if (!next || isUuidLike(next)) return '—';
  return next;
};

const resolveUsernameDisplay = (row: UserRow): string => {
  const username = String(row.username ?? '').trim();
  if (username && !isUuidLike(username)) return username;
  const email = String(row.email ?? '').trim();
  if (email && !isUuidLike(email)) return email;
  return '—';
};

const extractEdgeError = async (data: any, error: any): Promise<EdgeErrorInfo> => {
  if (data?.error) {
    return {
      code: data.error,
      message: data.details ? `${data.error}: ${data.details}` : data.error,
    };
  }

  const response = error?.context?.response;
  if (response) {
    try {
      const clone = response.clone();
      const raw = await clone.text();
      try {
        const body = JSON.parse(raw);
        if (body?.error) {
          return {
            code: body.error,
            message: body.details ? `${body.error}: ${body.details}` : body.error,
          };
        }
      } catch {
        // ignore JSON parse errors
      }
      return { message: response.statusText || 'Edge function error' };
    } catch {
      return { message: response.statusText || 'Edge function error' };
    }
  }

  return { message: error?.message || 'Edge function error' };
};

const extractEdgeErrorMessage = async (data: any, error: any): Promise<string> => {
  const info = await extractEdgeError(data, error);
  return info.message;
};

const invokeEdge = async <T,>(name: string, body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message || 'Edge function error');
  }
  return data as T;
};

const createAdminUser = async (tenantId: string, payload: Record<string, unknown>): Promise<CreateUserResponse> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
  };
  if (ADMIN_API_KEY) {
    headers['x-shopflow-admin-key'] = ADMIN_API_KEY;
  }

  const response = await fetch(`${ADMIN_API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();
  let data: any = null;
  if (rawText && contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payloadData = data && typeof data === 'object' ? (data as AdminApiErrorPayload) : null;
    const parts: string[] = [];
    if (payloadData?.message) {
      parts.push(payloadData.message);
    } else if (payloadData?.reason) {
      parts.push(payloadData.reason);
    } else if (payloadData?.error) {
      parts.push(payloadData.error);
    } else if (response.statusText) {
      parts.push(response.statusText);
    } else {
      parts.push('Request failed');
    }
    if (payloadData?.details) {
      parts.push(`details=${JSON.stringify(payloadData.details)}`);
    }
    if (payloadData?.context) {
      parts.push(`context=${JSON.stringify(payloadData.context)}`);
    }
    if (!payloadData && rawText) {
      parts.push(rawText);
    }
    const err: any = new Error(parts.join(' | '));
    err.payload = payloadData ?? data ?? (rawText ? { error: rawText } : null);
    throw err;
  }

  return data as CreateUserResponse;
};

const removeUserFromTenantByUserId = async (
  tenantId: string,
  userId: string,
  actorUserId?: string
): Promise<RemoveFromTenantResponse> => {
  if (!ADMIN_API_KEY) {
    throw new Error('Missing VITE_SHOPFLOW_ADMIN_API_KEY');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Tenant-Id': tenantId,
    'x-shopflow-admin-key': ADMIN_API_KEY,
  };
  if (actorUserId && isUuidLike(actorUserId)) {
    headers['x-actor-user-id'] = actorUserId;
  }

  const response = await fetch(`${ADMIN_API_BASE_URL}/admin/tenant-users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();
  let data: any = null;
  if (rawText && contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payloadData = data && typeof data === 'object' ? (data as AdminApiErrorPayload) : null;
    const parts: string[] = [];
    if (payloadData?.message) {
      parts.push(payloadData.message);
    } else if (payloadData?.reason) {
      parts.push(payloadData.reason);
    } else if (payloadData?.error) {
      parts.push(payloadData.error);
    } else if (response.statusText) {
      parts.push(response.statusText);
    } else {
      parts.push('Request failed');
    }
    if (payloadData?.details) {
      parts.push(`details=${JSON.stringify(payloadData.details)}`);
    }
    if (payloadData?.context) {
      parts.push(`context=${JSON.stringify(payloadData.context)}`);
    }
    if (!payloadData && rawText) {
      parts.push(rawText);
    }
    const err: any = new Error(parts.join(' | '));
    err.payload = payloadData ?? data ?? (rawText ? { error: rawText } : null);
    throw err;
  }

  return data as RemoveFromTenantResponse;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const ensureActiveTenant = useAuthStore((state) => state.ensureActiveTenant);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [tenantId, setTenantId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createRole, setCreateRole] = useState('technician');
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [createPasswordError, setCreatePasswordError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createSubmitError, setCreateSubmitError] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<UserRow | null>(null);

  const rowsSorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aCreated - bCreated;
    });
  }, [rows]);

  const currentUserId = profile?.id ?? '';
  const currentUserRow = rows.find((row) => row.user_id === currentUserId || row.id === currentUserId);
  const rowRoleKey = (currentUserRow?.role_key ?? '').toString().toLowerCase();
  const profileRoleKey = (profile?.roleKey ?? profile?.role ?? '').toString().toLowerCase();
  const isAdmin = (rowRoleKey || profileRoleKey) === 'admin';

  const getRowActionKey = (row: UserRow): string => {
    return String(row.id || row.user_id || '').trim();
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let nextTenantId = String(activeTenantId || '').trim();
      if (!isUuidLike(nextTenantId)) {
        const ensuredTenantId = await ensureActiveTenant(currentUserId || undefined);
        nextTenantId = String(ensuredTenantId || '').trim();
      }
      if (!isUuidLike(nextTenantId)) {
        throw new Error('No active tenant selected');
      }
      setTenantId(nextTenantId);
      const data = await listUsers(nextTenantId, currentUserId || undefined);
      setRows(data);
      if (data.length > 0 && data[0].tenant_id) {
        setTenantId(data[0].tenant_id ?? nextTenantId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, currentUserId, ensureActiveTenant]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const setBusy = (userId: string, value: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (value) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  };

  const handleRoleChange = async (row: UserRow, nextRole: string) => {
    if (!isAdmin) return;
    const nextRoleKey = nextRole.toLowerCase();
    const currentRoleKey = (row.role_key ?? row.membership_role ?? '').toString().toLowerCase();
    if (nextRoleKey === currentRoleKey) return;
    const targetUserId = String(row.id || row.user_id || '').trim();
    if (!isUuidLike(targetUserId)) {
      toast({
        title: 'Role update failed',
        description: 'Cannot update role for row without a valid user id.',
        variant: 'destructive',
      });
      return;
    }
    const tenantId = row.tenant_id ?? '';
    if (!tenantId) {
      toast({
        title: 'Missing tenant',
        description: 'Cannot update role without tenant_id from directory view.',
        variant: 'destructive',
      });
      return;
    }
    const busyKey = getRowActionKey(row) || targetUserId;
    setBusy(busyKey, true);
    try {
      await invokeEdge<UpdateRoleResponse>('users-update-role', {
        tenant_id: tenantId,
        user_id: targetUserId,
        role_key: nextRoleKey,
      });
      toast({ title: 'Role updated' });
      await loadUsers();
    } catch (err: any) {
      toast({
        title: 'Role update failed',
        description: err?.message || 'Unable to update role',
        variant: 'destructive',
      });
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleRemoveClick = (row: UserRow) => {
    if (!isAdmin) return;
    if (getRemoveDisabledReason(row, false)) return;
    setRemoveTarget(row);
    setRemoveOpen(true);
  };

  const handleRemoveOpenChange = (open: boolean) => {
    setRemoveOpen(open);
    if (!open) {
      setRemoveTarget(null);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!isAdmin || !removeTarget) return;

    const targetTenantId = String(tenantId).trim();
    if (!targetTenantId) {
      toast({
        title: 'Missing tenant',
        description: 'Cannot remove user without tenant_id.',
        variant: 'destructive',
      });
      return;
    }

    const userId = String(removeTarget.id || removeTarget.user_id || '').trim();
    const busyKey = getRowActionKey(removeTarget) || userId;
    if (!busyKey) {
      toast({
        title: 'Remove failed',
        description: 'Missing user id.',
        variant: 'destructive',
      });
      return;
    }

    setBusy(busyKey, true);
    try {
      if (!isUuidLike(userId)) {
        throw new Error('Invalid user id.');
      }
      await removeUserFromTenantByUserId(targetTenantId, userId, currentUserId || undefined);
      toast({ title: 'Removed from tenant' });
      handleRemoveOpenChange(false);
      await loadUsers();
    } catch (err: any) {
      toast({
        title: 'Remove failed',
        description: err?.message || 'Unable to remove user from this shop',
        variant: 'destructive',
      });
    } finally {
      setBusy(busyKey, false);
    }
  };

  const getRemoveDisabledReason = (row: UserRow, isBusy: boolean): string | null => {
    if (!isAdmin) return 'Admin role required.';
    if (isBusy) return 'Request in progress.';
    const targetUserId = String(row.id || row.user_id || '').trim();
    const hasUserId = isUuidLike(targetUserId);
    if (!hasUserId) return 'No removable id is available for this row.';
    if (currentUserId && targetUserId === currentUserId) return 'Cannot remove your own membership from this tenant.';
    if (row.can_remove_from_tenant === false) {
      return row.remove_disabled_reason ?? 'Remove is blocked by membership safety checks.';
    }
    return null;
  };

  const getPasswordError = (password: string, confirm: string) => {
    if (!password) return 'Password is required.';
    if (password.length < 10) return 'Password must be at least 10 characters.';
    if (!confirm) return 'Confirm password is required.';
    if (password !== confirm) return 'Passwords do not match.';
    return '';
  };

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (open) {
      setCreateEmail('');
      setCreateFullName('');
      setCreateRole('technician');
      setCreatePassword('');
      setCreatePasswordConfirm('');
      setCreatePasswordError('');
      setCreateSubmitError('');
    }
  };

  const handleCreateUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = createEmail.trim().toLowerCase();
    const roleKey = createRole.trim().toLowerCase();

    const passwordError = getPasswordError(createPassword, createPasswordConfirm);
    setCreatePasswordError(passwordError);
    setCreateSubmitError('');

    if (!email || !email.includes('@')) {
      setCreateSubmitError('A valid email is required.');
      return;
    }
    if (!roleKey) {
      setCreateSubmitError('Role is required.');
      return;
    }
    if (passwordError) {
      setCreateSubmitError(passwordError);
      return;
    }
    if (!tenantId) {
      setCreateSubmitError('Select a tenant before creating a user.');
      return;
    }
    if (!isAdmin) {
      setCreateSubmitError('Admin role required to create users.');
      return;
    }

    setCreateBusy(true);
    try {
      const fullName = createFullName.trim();
      const createData = await createAdminUser(tenantId, {
        email,
        full_name: fullName || undefined,
        role_key: roleKey,
        password: createPassword,
      });
      toast({ title: 'User created', description: createData?.email ?? 'User created.' });
      setCreateOpen(false);
      await loadUsers();
    } catch (err: any) {
      const message = err?.message || 'Unable to create user';
      setCreateSubmitError(message);
      toast({
        title: 'Create failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="page-container space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={!isAdmin}>Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateUserSubmit} className="space-y-3">
              <DialogHeader>
                <DialogTitle>Create User</DialogTitle>
              </DialogHeader>
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={createEmail}
                  onChange={(e) => {
                    setCreateEmail(e.target.value);
                  }}
                  placeholder="name@example.com"
                  type="email"
                  disabled={createBusy}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Full name (optional)</label>
                <Input
                  value={createFullName}
                  onChange={(e) => {
                    setCreateFullName(e.target.value);
                  }}
                  placeholder="Jane Smith"
                  disabled={createBusy}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={createRole}
                  onValueChange={(value) => {
                    setCreateRole(value);
                  }}
                  disabled={createBusy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {createRoleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Password</label>
                <Input
                  value={createPassword}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCreatePassword(next);
                    setCreatePasswordError(getPasswordError(next, createPasswordConfirm));
                  }}
                  type="password"
                  autoComplete="new-password"
                  disabled={createBusy}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Confirm password</label>
                <Input
                  value={createPasswordConfirm}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCreatePasswordConfirm(next);
                    setCreatePasswordError(getPasswordError(createPassword, next));
                  }}
                  type="password"
                  autoComplete="new-password"
                  disabled={createBusy}
                />
                {createPasswordError && (
                  <div className="text-xs text-destructive">{createPasswordError}</div>
                )}
              </div>
              {!isAdmin && (
                <div className="text-sm text-muted-foreground">Admin role required to create users.</div>
              )}
              {createSubmitError && <div className="text-sm text-destructive">{createSubmitError}</div>}
              <DialogFooter>
                <Button type="submit" disabled={createBusy}>
                  {createBusy ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!isAdmin && (
        <div className="text-sm text-muted-foreground">
          You have read-only access. Admin role required for user changes.
        </div>
      )}

      {loading && <div>Loading users...</div>}
      {error && <div className="text-destructive">Error: {error}</div>}

      {!loading && !error && (
        <div className="space-y-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Full name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
              {rowsSorted.map((row, index) => {
                const displayRoleRaw = (row.role_key ?? row.membership_role ?? 'member').toString().trim();
                const displayRole = isUuidLike(displayRoleRaw) ? 'member' : displayRoleRaw || 'member';
                const normalizedRole = displayRole.toLowerCase();
                const roleValue = roleOptions.some((opt) => opt.value === normalizedRole) ? normalizedRole : '';
                const rowActionKey = getRowActionKey(row);
                const rowUserId = String(row.id || row.user_id || '').trim();
                const canChangeUser = isUuidLike(rowUserId);
                const isBusy = Boolean(rowActionKey) && busyIds.has(rowActionKey);
                const removeDisabledReason = getRemoveDisabledReason(row, isBusy);
                const canRemove = !removeDisabledReason;
                const usernameDisplay = resolveUsernameDisplay(row);
                const emailDisplay = sanitizeDisplayValue(row.email);
                const fullNameDisplay = sanitizeDisplayValue(row.full_name);
                return (
                  <TableRow key={rowActionKey || `row-${index}`}>
                    <TableCell>{usernameDisplay}</TableCell>
                    <TableCell>{emailDisplay}</TableCell>
                    <TableCell>{fullNameDisplay}</TableCell>
                    <TableCell>
                      <Select
                        value={roleValue}
                        onValueChange={(val) => handleRoleChange(row, val)}
                        disabled={!isAdmin || isBusy || !canChangeUser}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder={displayRole} />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="inline-flex items-center gap-2">
                          {isBusy && <span className="text-xs text-muted-foreground">Saving...</span>}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleRemoveClick(row);
                                  }}
                                  disabled={!canRemove}
                                >
                                  Remove
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {removeDisabledReason && <TooltipContent>{removeDisabledReason}</TooltipContent>}
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={removeOpen} onOpenChange={handleRemoveOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user from this shop?</DialogTitle>
            <DialogDescription>
              This removes the user from this shop. Their account will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleRemoveOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleRemoveConfirm();
              }}
              disabled={!removeTarget || !getRowActionKey(removeTarget) || busyIds.has(getRowActionKey(removeTarget))}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
