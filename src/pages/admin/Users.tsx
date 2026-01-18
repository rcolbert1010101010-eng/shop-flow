import { useEffect, useMemo, useState } from 'react';
import { UserPlus, RefreshCcw, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/security/usePermissions';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import {
  assignRole,
  createUser,
  listRoles,
  listUsers,
  setUserActive,
  type AdminRole,
  type AdminUser,
} from '@/repos/api/usersRepoApi';

export default function AdminUsers() {
  const { can, isReady } = usePermissions();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role_key: '' });

  const load = useMemo(
    () => async () => {
      if (!can('admin.users')) return;
      setLoading(true);
      try {
        const [fetchedUsers, fetchedRoles] = await Promise.all([listUsers(), listRoles()]);
        setUsers(fetchedUsers);
        setRoles(fetchedRoles);
        if (!form.role_key && fetchedRoles.length > 0) {
          setForm((prev) => ({ ...prev, role_key: fetchedRoles[0].key }));
        }
      } catch (err: any) {
        toast({
          title: 'Failed to load users',
          description: err?.message ?? 'An error occurred while loading users.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [can, form.role_key, toast]
  );

  useEffect(() => {
    if (isReady && can('admin.users')) {
      void load();
    }
  }, [isReady, can, load]);

  const handleCreate = async () => {
    if (!form.email || !form.role_key) {
      toast({ title: 'Email and role are required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      await createUser({
        email: form.email,
        full_name: form.full_name,
        role_key: form.role_key,
      });
      toast({ title: 'User invited', description: 'An invitation email has been sent.' });
      setCreateOpen(false);
      setForm({ email: '', full_name: '', role_key: roles[0]?.key ?? '' });
      await load();
    } catch (err: any) {
      toast({
        title: 'Failed to create user',
        description: err?.message ?? 'An error occurred while creating the user.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, roleKey: string) => {
    try {
      await assignRole(userId, roleKey);
      toast({ title: 'Role updated' });
      await load();
    } catch (err: any) {
      toast({
        title: 'Failed to update role',
        description: err?.message ?? 'An error occurred while updating the role.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await setUserActive(user.id, !user.is_active);
      toast({ title: `User ${user.is_active ? 'deactivated' : 'activated'}` });
      await load();
    } catch (err: any) {
      toast({
        title: 'Failed to update user',
        description: err?.message ?? 'An error occurred while updating the user.',
        variant: 'destructive',
      });
    }
  };

  if (!isReady) {
    return (
      <div className="page-container">
        <PageHeader title="Users" subtitle="Administer user accounts" />
        <Card>
          <CardContent className="p-6 text-muted-foreground">Loading permissions...</CardContent>
        </Card>
      </div>
    );
  }

  if (!can('admin.users')) {
    return (
      <div className="page-container">
        <PageHeader title="Users" subtitle="Administer user accounts" />
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-lg font-semibold">Access denied</div>
            <div className="text-muted-foreground">You do not have permission to view this page.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title="Users"
        subtitle="Manage user accounts and roles"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="admin-users" context={{ hasUsers: users.length > 0 }} />
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role_key}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, role_key: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.key} value={role.key}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleCreate()} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Loading users...
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.full_name || '-'}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role_key ?? undefined}
                        onValueChange={(value) => void handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.key} value={role.key}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={user.is_active} onCheckedChange={() => void handleToggleActive(user)} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      User ID: {user.id}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
