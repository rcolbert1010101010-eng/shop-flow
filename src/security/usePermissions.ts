import { useMemo } from 'react';
import { type Role, type Capability, can } from './rbac';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook for accessing current user permissions
 */
export function usePermissions() {
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  
  // Default to TECH until profile loads or if profile is missing
  const role: Role = profile?.role ?? 'TECH';

  const canCheck = useMemo(
    () => (capability: Capability) => can(role, capability),
    [role]
  );

  return {
    role,
    can: canCheck,
    loading,
    isReady: !loading,
  };
}
