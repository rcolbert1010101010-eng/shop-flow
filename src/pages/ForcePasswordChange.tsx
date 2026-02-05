import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ForcePasswordChange() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const loadProfile = useAuthStore((state) => state.loadProfile);

  const withTimeout = async <T,>(
    promise: Promise<T>,
    ms = 15000,
    message = 'Password update timed out. Please try again.'
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(message)),
        ms
      );
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured');
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }
      const sessionUser = sessionData?.session?.user;
      if (!sessionUser) {
        throw new Error('Session expired. Please log in again.');
      }
      await withTimeout(
        (async () => {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            throw refreshError;
          }
          console.info('ForcePasswordChange: updating auth password...');
          const { error: updateError } = await supabase.auth.updateUser({ password });
          if (updateError) {
            throw updateError;
          }
        })(),
        15000
      );
      console.info('ForcePasswordChange: auth password updated');
      console.info('ForcePasswordChange: clearing must_change_password...');
      const { error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', sessionUser.id),
        15000,
        'Profile update timed out. Please try again.'
      );
      if (profileError) {
        throw profileError;
      }
      console.info('ForcePasswordChange: profile updated');
      await loadProfile(sessionUser.id);
      toast({ title: 'Password updated' });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message =
        err?.code === 'same_password'
          ? 'New password must be different from the temporary password.'
          : err?.message || 'Unable to update password';
      setError(message);
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Update your password</CardTitle>
          <p className="text-sm text-muted-foreground">
            For security, you must change your password before continuing.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                disabled={saving}
                required
              />
              <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (error) setError('');
                }}
                disabled={saving}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
