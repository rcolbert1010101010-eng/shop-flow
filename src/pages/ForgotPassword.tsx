import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toAuthEmailFromUsername } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const withTimeout = async <T,>(
    promise: Promise<T>,
    ms = 15000,
    message = 'Password reset timed out. Please try again.'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!identifier) {
      setError('Email or username is required.');
      return;
    }

    let watchdog: ReturnType<typeof setTimeout> | null = null;
    setSaving(true);
    try {
      watchdog = setTimeout(() => {
        setError((prev) => prev || 'Password reset timed out. Please try again.');
        setSaving(false);
      }, 16000);

      if (!supabase) {
        throw new Error('Supabase is not configured');
      }

      const trimmed = identifier.trim();
      const email = trimmed.includes('@')
        ? trimmed.toLowerCase()
        : toAuthEmailFromUsername(trimmed);

      const { error: resetError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        15000,
        'Password reset timed out. Please try again.'
      );
      if (resetError) {
        throw resetError;
      }

      setSuccess('If an account exists, a reset link has been sent.');
    } catch (err: any) {
      setError(err?.message || 'Unable to send reset email');
    } finally {
      if (watchdog) {
        clearTimeout(watchdog);
      }
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Reset your password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email or username and we’ll send a reset link.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or username</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError('');
                }}
                disabled={saving}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-foreground">{success}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Sending...' : 'Send reset link'}
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
