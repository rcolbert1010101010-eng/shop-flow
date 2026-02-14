import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useEnsureActiveTenant() {
  const userId = useAuthStore((state) => state.user?.id);
  const ensureActiveTenant = useAuthStore((state) => state.ensureActiveTenant);

  useEffect(() => {
    if (!userId) return;
    void ensureActiveTenant(userId);
  }, [userId, ensureActiveTenant]);
}

