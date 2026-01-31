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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/security/usePermissions';
import { inviteUser, listUsers, setUserRole, updateUserProfile, type UserRow } from '@/repos/api/usersRepoApi';

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
    mutationFn: async (payload: { id: string; is_active?: boolean }) => {
      await updateUserProfile(payload.id, { is_active: payload.is_active });
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

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Invite sent' });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
    },
    onError: (err: any) => {
      toast({ title: 'Invite failed', description: err?.message || 'Error inviting user', variant: 'destructive' });
    },
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('TECHNICIAN');
  const [inviteName, setInviteName] = useState('');

  const rows: UserRow[] = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);

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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
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
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invite email and assign a role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Full name (optional)</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
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
              onClick={() =>
                inviteMutation.mutate({
                  email: inviteEmail,
                  role: inviteRole.toUpperCase(),
                  full_name: inviteName || null,
                })
              }
              disabled={inviteMutation.isLoading}
            >
              {inviteMutation.isLoading ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
