import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function LoginRedirect({ children }: { children: React.ReactNode }) {
  const { session, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
