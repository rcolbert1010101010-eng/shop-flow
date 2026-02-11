import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

type UpdateRoleResponse = {
  user_id: string;
  role_key: string;
};

type ToggleActiveResponse = {
  user_id: string;
  is_active: boolean;
};

const extractEdgeErrorMessage = async (data: any, error: any): Promise<string> => {
  if (data?.error) {
    return data.details ? `${data.error}: ${data.details}` : data.error;
  }

  const response = error?.context?.response;
  if (response) {
    try {
      const clone = response.clone();
      const raw = await clone.text();
      try {
        const body = JSON.parse(raw);
        if (body?.error) {
          return body.details ? `${body.error}: ${body.details}` : body.error;
        }
      } catch {
        // ignore JSON parse errors
      }
      return response.statusText || 'Edge function error';
    } catch {
      return response.statusText || 'Edge function error';
    }
  }

  return error?.message || 'Edge function error';
};

const invokeEdge = async <T,>(name: string, body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await extractEdgeErrorMessage(data, error);
    throw new Error(message || 'Edge function error');
  }
  return data as T;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const profile = useAuthStore((state) => state.profile);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const rowsSorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aCreated - bCreated;
    });
  }, [rows]);

  const currentUserId = profile?.id ?? '';
  const currentUserRow = rows.find((row) => row.user_id === currentUserId);
  const rowRoleKey = (currentUserRow?.role_key ?? '').toString().toLowerCase();
  const profileRoleKey = (profile?.roleKey ?? profile?.role ?? '').toString().toLowerCase();
  const isAdmin = (rowRoleKey || profileRoleKey) === 'admin';

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setRows(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

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
    const tenantId = row.tenant_id ?? '';
    if (!tenantId) {
      toast({
        title: 'Missing tenant',
        description: 'Cannot update role without tenant_id from directory view.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(row.user_id, true);
    try {
      await invokeEdge<UpdateRoleResponse>('users-update-role', {
        tenant_id: tenantId,
        user_id: row.user_id,
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
      setBusy(row.user_id, false);
    }
  };

  const handleToggleActive = async (row: UserRow, nextActive: boolean) => {
    if (!isAdmin) return;
    if (nextActive === !!row.is_active) return;
    setBusy(row.user_id, true);
    try {
      await invokeEdge<ToggleActiveResponse>('users-toggle-active', {
        user_id: row.user_id,
        is_active: nextActive,
      });
      toast({ title: nextActive ? 'User activated' : 'User deactivated' });
      await loadUsers();
    } catch (err: any) {
      toast({
        title: 'Status update failed',
        description: err?.message || 'Unable to update status',
        variant: 'destructive',
      });
    } finally {
      setBusy(row.user_id, false);
    }
  };

  return (
    <div className="page-container space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex items-center gap-2">
          <Button disabled>Invite User (Coming next)</Button>
        </div>
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
          <div>Rows: {rowsSorted.length}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>user_id</TableHead>
                <TableHead>email</TableHead>
                <TableHead>full_name</TableHead>
                <TableHead>role_key</TableHead>
                <TableHead>membership_role</TableHead>
                <TableHead>is_active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
              {rowsSorted.map((row) => {
                const displayRole = (row.role_key ?? row.membership_role ?? 'member').toString();
                const normalizedRole = displayRole.toLowerCase();
                const roleValue = roleOptions.some((opt) => opt.value === normalizedRole) ? normalizedRole : '';
                const isBusy = busyIds.has(row.user_id);
                return (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-mono text-xs">{row.user_id}</TableCell>
                    <TableCell>{row.email ?? ''}</TableCell>
                    <TableCell>{row.full_name ?? ''}</TableCell>
                    <TableCell>
                      <Select
                        value={roleValue}
                        onValueChange={(val) => handleRoleChange(row, val)}
                        disabled={!isAdmin || isBusy}
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
                    <TableCell>{row.membership_role ?? ''}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!row.is_active}
                          onCheckedChange={(checked) => handleToggleActive(row, checked)}
                          disabled={!isAdmin || isBusy}
                        />
                        <span className="text-xs text-muted-foreground">
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {isBusy ? 'Saving...' : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
