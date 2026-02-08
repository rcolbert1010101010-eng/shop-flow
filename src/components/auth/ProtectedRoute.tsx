import { useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute() {
  const { session, loading, initialize, profile } = useAuthStore();
  const location = useLocation();
  const isForcePasswordChange = location.pathname === '/force-password-change';

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading && !(session?.user && isForcePasswordChange)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isForcePasswordChange) {
    return <Outlet />;
  }

  if (profile?.mustChangePassword && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />;
  }

  return <Outlet />;
}
