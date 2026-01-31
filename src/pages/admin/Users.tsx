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
import {
  createUser,
  listUsers,
  removeUserFromTenant,
  setUserRole,
  updateUserProfile,
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
    mutationFn: createUser,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User created' });
      setCreateOpen(false);
      setCreateUsername('');
      setCreatePassword('');
      setCreatePasswordConfirm('');
      setCreateName('');
    },
    onError: (err: any) => {
      toast({ title: 'Create failed', description: err?.message || 'Error creating user', variant: 'destructive' });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await removeUserFromTenant(userId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User removed' });
      setRemoveOpen(false);
      setRemoveUser(null);
    },
    onError: (err: any) => {
      toast({ title: 'Remove failed', description: err?.message || 'Error removing user', variant: 'destructive' });
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [createRole, setCreateRole] = useState('TECHNICIAN');
  const [createName, setCreateName] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeUser, setRemoveUser] = useState<UserRow | null>(null);

  const rows: UserRow[] = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);

  const handleCreateUser = async () => {
    const username = createUsername.trim().toLowerCase();
    const password = createPassword;
    const confirmPassword = createPasswordConfirm;
    const role = createRole.toUpperCase();
    const full_name = createName || null;

    if (!username) {
      toast({ title: 'Username is required', variant: 'destructive' });
      return;
    }

    if (!password) {
      toast({ title: 'Password is required', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    try {
      await createUserMutation.mutateAsync({ username, password, role, full_name });
    } catch {
      // Errors are handled via createUserMutation onError
    }
  };

  const handleEditOpen = (row: UserRow) => {
    setEditUserId(row.id);
    setEditName(row.full_name || '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editUserId) return;
    try {
      await updateProfileMutation.mutateAsync({
        id: editUserId,
        full_name: editName.trim() || null,
      });
      setEditOpen(false);
      setEditUserId(null);
      setEditName('');
    } catch {
      // Errors are handled via updateProfileMutation onError
    }
  };

  const handleRemoveOpen = (row: UserRow) => {
    setRemoveUser(row);
    setRemoveOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!removeUser?.id) return;
    try {
      await removeUserMutation.mutateAsync(removeUser.id);
    } catch {
      // Errors are handled via removeUserMutation onError
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
              <Button>Create User (username/password)</Button>
            </DialogTrigger>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
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
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.full_name || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={(row.role || 'TECHNICIAN').toUpperCase()}
                        onValueChange={(val) => updateRoleMutation.mutate({ id: row.id, role: val.toUpperCase() })}
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
                        {row.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Active</span>
                          <Switch
                            checked={!!row.is_active}
                            onCheckedChange={(checked) =>
                              updateProfileMutation.mutate({ id: row.id, is_active: checked })
                            }
                          />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleEditOpen(row)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRemoveOpen(row)}>
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a user with a username and password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-1">
              <Label>Full name (optional)</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Password"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={createPasswordConfirm}
                onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                placeholder="Confirm password"
              />
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
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditUserId(null);
            setEditName('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the user's profile details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleEditSave}
              disabled={!editUserId || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the user and remove them from the current tenant. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              disabled={removeUserMutation.isPending}
            >
              {removeUserMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
