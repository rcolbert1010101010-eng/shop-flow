import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');
  const session = useAuthStore((state) => state.session);
  const initialize = useAuthStore((state) => state.initialize);
  const navigate = useNavigate();
  const { toast } = useToast();

  const withTimeout = async <T,>(
    promise: Promise<T>,
    ms = 15000,
    message = 'Password update timed out. Please try again.'
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    let active = true;
    const deadline = Date.now() + 8000;

    if (session?.user) {
      setChecking(false);
      return;
    }

    const interval = setInterval(() => {
      if (!active) return;
      if (session?.user) {
        setChecking(false);
        clearInterval(interval);
        return;
      }
      if (Date.now() >= deadline) {
        setChecking(false);
        setLinkError('Invalid or expired link');
        clearInterval(interval);
      }
    }, 250);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session?.user]);

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
    if (!session?.user) {
      setError('Invalid or expired link');
      return;
    }

    let watchdog: ReturnType<typeof setTimeout> | null = null;
    setSaving(true);
    try {
      watchdog = setTimeout(() => {
        setError((prev) => prev || 'Password update timed out. Please try again.');
        setSaving(false);
      }, 16000);

      if (!supabase) {
        throw new Error('Supabase is not configured');
      }

      const { error: updateError } = await withTimeout(
        supabase.auth.updateUser({ password }),
        15000,
        'Password update timed out. Please try again.'
      );
      if (updateError) {
        throw updateError;
      }

      toast({ title: 'Password updated' });
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Unable to update password');
    } finally {
      if (watchdog) {
        clearTimeout(watchdog);
      }
      setSaving(false);
    }
  };

  if (linkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Reset your password</CardTitle>
            <p className="text-sm text-muted-foreground">{linkError}</p>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Reset your password</CardTitle>
          <p className="text-sm text-muted-foreground">
            {checking ? 'Checking link…' : 'Enter a new password to continue.'}
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
                disabled={saving || checking}
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
                disabled={saving || checking}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={saving || checking}>
              {saving ? 'Saving...' : 'Update password'}
            </Button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground underline">
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
