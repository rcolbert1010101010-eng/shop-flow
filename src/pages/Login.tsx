import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const signIn = useAuthStore((state) => state.signIn);
  const navigate = useNavigate();

  const normalizeUsername = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._-]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const rawInput = username;
      const hasAt = rawInput.includes('@');
      const normalized = hasAt ? '' : normalizeUsername(rawInput);
      const emailInput = hasAt ? rawInput : `${normalized}@local.shopflow`;
      await signIn(emailInput, password);
      navigate('/');
    } catch (error: any) {
      let finalError = error;
      const rawInput = username;
      const hasAt = rawInput.includes('@');
      if (!hasAt) {
        try {
          const normalized = normalizeUsername(rawInput);
          const fallbackEmail = `${normalized}@shopflow.local`;
          await signIn(fallbackEmail, password);
          navigate('/');
          return;
        } catch (fallbackError: any) {
          finalError = fallbackError;
        }
      }
      toast({
        title: 'Sign in failed',
        description: finalError?.message || 'Invalid email or password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in to ShopFlow</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your username and password to continue
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              required
              disabled={isLoading}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
