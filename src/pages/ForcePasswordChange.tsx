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
  const session = useAuthStore((state) => state.session);
  const setMustChangePassword = useAuthStore((state) => state.setMustChangePassword);
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
      const sessionUser = session?.user;
      if (!sessionUser) {
        throw new Error('Session expired. Please log in again.');
      }
      const { error: initialUpdateError } = await withTimeout(
        supabase.auth.updateUser({ password }),
        15000,
        'Password update timed out. Please try again.'
      );
      if (initialUpdateError) {
        const message = initialUpdateError?.message?.toLowerCase?.() || '';
        const code = (initialUpdateError as any)?.code;
        const isAuthError =
          message.includes('jwt') ||
          message.includes('token') ||
          message.includes('invalid') ||
          message.includes('expired') ||
          code === 'invalid_jwt' ||
          code === 'jwt_expired' ||
          code === 'auth_invalid_token';
        if (!isAuthError) {
          throw initialUpdateError;
        }
        setError('Session is stale. Please sign in again.');
        try {
          await withTimeout(supabase.auth.signOut(), 5000, 'Sign out timed out.');
        } catch {
          // ignore sign out errors
        }
        navigate('/login', { replace: true });
        return;
      }
      const { error: profileError } = await withTimeout(
        supabase.rpc('clear_my_must_change_password'),
        15000,
        'Profile update timed out. Please try again.'
      );
      if (profileError) {
        throw profileError;
      }
      setMustChangePassword(false);
      toast({ title: 'Password updated' });
      navigate('/dashboard', { replace: true });
      setTimeout(() => {
        if (window.location.pathname === '/force-password-change') {
          window.location.href = '/dashboard';
        }
      }, 250);
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
