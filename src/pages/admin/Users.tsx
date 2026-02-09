import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/security/usePermissions';
import { normalizeAuthUsername } from '@/lib/auth';
import {
  deactivateUser,
  inviteUser,
  listUsers,
  reactivateUser,
  setUserRole,
  updateUserProfile,
  type InviteUserResponse,
  type UserLifecycleResponse,
  type UserRow,
} from '@/repos/api/usersRepoApi';

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SERVICE_WRITER', label: 'Service Writer' },
  { value: 'TECHNICIAN', label: 'Technician' },
  { value: 'PARTS_MANAGER', label: 'Parts Manager' },
  { value: 'SALES_COUNTER', label: 'Sales Counter' },
  { value: 'GUEST', label: 'Guest' },
];

export default function AdminUsers() {
  const { can, role } = usePermissions();
  const isAdmin = role === 'ADMIN' || can('settings.edit');
  const { toast } = useToast();
  const qc = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { id: string; is_active?: boolean; full_name?: string | null }) => {
      await updateUserProfile(payload.id, { is_active: payload.is_active, full_name: payload.full_name });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err?.message || 'Error updating user', variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (payload: { id: string; role: string }) => {
      await setUserRole(payload.id, payload.role);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Role updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err?.message || 'Error updating role', variant: 'destructive' });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (result: InviteUserResponse) => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      const description = result.created
        ? `User created without invite email${result.temp_password ? ` (temp password: ${result.temp_password})` : ''}.`
        : result.invited
          ? 'Invite email sent.'
          : 'User already existed; tenant membership and role were updated.';
      toast({ title: 'User provisioned', description });
      setCreateOpen(false);
      setCreateUsername('');
      setCreateEmail('');
      setCreateName('');
      setCreateEmailError('');
    },
    onError: (err: any) => {
      toast({ title: 'Create failed', description: err?.message || 'Error creating user', variant: 'destructive' });
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (payload: { userId: string; action: 'deactivate' | 'reactivate' }) => {
      if (payload.action === 'deactivate') {
        return deactivateUser(payload.userId);
      }
      return reactivateUser(payload.userId);
    },
    onSuccess: (result: UserLifecycleResponse) => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      const title = result.action === 'deactivate' ? 'User deactivated' : 'User reactivated';
      const description = result.already_in_state
        ? 'No change was needed.'
        : result.changed
          ? 'User status updated.'
          : undefined;
      toast({ title, description });
      setLifecycleOpen(false);
      setLifecycleUser(null);
    },
    onError: (err: any) => {
      toast({ title: 'Status update failed', description: err?.message || 'Error updating user status', variant: 'destructive' });
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createEmailError, setCreateEmailError] = useState('');
  const [createRole, setCreateRole] = useState('TECHNICIAN');
  const [createName, setCreateName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ full_name: string; role: string; is_active: boolean }>({
    full_name: '',
    role: 'TECHNICIAN',
    is_active: true,
  });
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleUser, setLifecycleUser] = useState<UserRow | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<'deactivate' | 'reactivate'>('deactivate');

  const rows: UserRow[] = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);

  const handleCreateUser = async () => {
    const username = normalizeAuthUsername(createUsername);
    const email = createEmail.trim().toLowerCase();
    const role = createRole.toUpperCase();
    const full_name = createName || null;

    if (createUsername.trim() && !username) {
      toast({
        title: 'Invalid username',
        description: 'Username must be letters/numbers and . _ - only (no spaces)',
        variant: 'destructive',
      });
      return;
    }
    if (!email || !email.includes('@')) {
      setCreateEmailError('Enter a valid email address.');
      toast({ title: 'Invalid email', description: 'Enter a valid email address.', variant: 'destructive' });
      return;
    }

    try {
      await createUserMutation.mutateAsync({ email, role_key: role, full_name });
    } catch {
      // Errors are handled via createUserMutation onError
    }
  };

  const handleLifecycleOpen = (row: UserRow, action: 'deactivate' | 'reactivate') => {
    setLifecycleUser(row);
    setLifecycleAction(action);
    setLifecycleOpen(true);
  };

  const handleLifecycleConfirm = async () => {
    if (!lifecycleUser?.id) return;
    try {
      await lifecycleMutation.mutateAsync({ userId: lifecycleUser.id, action: lifecycleAction });
    } catch {
      // Errors are handled via lifecycleMutation onError
    }
  };

  const handleRowEditStart = (row: UserRow) => {
    setEditingId(row.id);
    setEditDraft({
      full_name: row.full_name || '',
      role: (row.role || 'TECHNICIAN').toUpperCase(),
      is_active: !!row.is_active,
    });
  };

  const handleRowEditCancel = () => {
    setEditingId(null);
    setEditDraft({ full_name: '', role: 'TECHNICIAN', is_active: true });
  };

  const handleRowEditSave = async (row: UserRow) => {
    try {
      const nextFullName = editDraft.full_name.trim() || null;
      const nextIsActive = editDraft.is_active;
      const nextRole = editDraft.role.toUpperCase();
      if (nextFullName !== (row.full_name ?? null) || nextIsActive !== !!row.is_active) {
        await updateProfileMutation.mutateAsync({
          id: row.id,
          full_name: nextFullName,
          is_active: nextIsActive,
        });
      }
      if (nextRole !== (row.role ?? 'TECHNICIAN').toUpperCase()) {
        await updateRoleMutation.mutateAsync({ id: row.id, role: nextRole });
      }
      handleRowEditCancel();
    } catch {
      // Errors are handled via mutation onError
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-container">
        <PageHeader title="Users" backTo="/settings" />
        <Alert variant="destructive">
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>Admin permissions required to manage users.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      <PageHeader title="Users" backTo="/settings" />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
            </div>
            <DialogTrigger asChild>
              <Button>Invite User</Button>
            </DialogTrigger>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editDraft.full_name}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, full_name: e.target.value }))}
                            placeholder="Full name"
                          />
                        ) : (
                          row.full_name || '—'
                        )}
                      </TableCell>
                      <TableCell>{row.username || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={isEditing ? editDraft.role : (row.role || 'TECHNICIAN').toUpperCase()}
                          onValueChange={(val) =>
                            isEditing
                              ? setEditDraft((prev) => ({ ...prev, role: val.toUpperCase() }))
                              : updateRoleMutation.mutate({ id: row.id, role: val.toUpperCase() })
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
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
                      <TableCell>
                        <Badge variant={row.is_active ? 'default' : 'secondary'}>
                          {row.is_active ? 'Active' : 'Deactivated'}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Active</span>
                            <Switch
                              checked={isEditing ? editDraft.is_active : !!row.is_active}
                              onCheckedChange={(checked) =>
                                isEditing
                                  ? setEditDraft((prev) => ({ ...prev, is_active: checked }))
                                  : updateProfileMutation.mutate({ id: row.id, is_active: checked })
                              }
                              disabled={!isEditing}
                            />
                          </div>
                          {isEditing ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleRowEditSave(row)}>
                                Save
                              </Button>
                              <Button variant="ghost" size="sm" onClick={handleRowEditCancel}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleRowEditStart(row)}>
                              Edit
                            </Button>
                          )}
                          <Button
                            variant={row.is_active ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => handleLifecycleOpen(row, row.is_active ? 'deactivate' : 'reactivate')}
                            disabled={isEditing}
                          >
                            {row.is_active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>User will set their password on first login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input
                value={createUsername}
                onChange={(e) => setCreateUsername(normalizeAuthUsername(e.target.value))}
                placeholder="username"
              />
              <p className="text-xs text-muted-foreground">Optional metadata only. Not sent to backend.</p>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={createEmail}
                onChange={(e) => {
                  setCreateEmail(e.target.value);
                  if (createEmailError) setCreateEmailError('');
                }}
                placeholder="name@example.com"
                type="email"
                required
              />
              {createEmailError && <p className="text-xs text-destructive">{createEmailError}</p>}
            </div>
            <div className="space-y-1">
              <Label>Full name (optional)</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? 'Inviting...' : 'Invite User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={lifecycleOpen}
        onOpenChange={(open) => {
          setLifecycleOpen(open);
          if (!open) {
            setLifecycleUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lifecycleAction === 'deactivate' ? 'Deactivate user?' : 'Reactivate user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lifecycleAction === 'deactivate'
                ? `This will deactivate ${lifecycleUser?.full_name || lifecycleUser?.email || 'this user'} for the current tenant.`
                : `This will reactivate ${lifecycleUser?.full_name || lifecycleUser?.email || 'this user'} for the current tenant.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLifecycleConfirm}
              disabled={lifecycleMutation.isPending}
            >
              {lifecycleMutation.isPending
                ? lifecycleAction === 'deactivate'
                  ? 'Deactivating...'
                  : 'Reactivating...'
                : lifecycleAction === 'deactivate'
                  ? 'Deactivate'
                  : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
