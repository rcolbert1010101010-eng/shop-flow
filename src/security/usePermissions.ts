import { useMemo } from 'react';
import { type Role, type Capability, can } from './rbac';

/**
 * Hook for accessing current user permissions
 * 
 * TODO: Replace hardcoded 'ADMIN' role with actual authenticated user's role
 * from auth profile once authentication is implemented.
 */
export function usePermissions() {
  // TODO: Replace with actual auth profile role
  // const { user } = useAuth();
  // const role = user?.role ?? 'TECH';
  const role: Role = 'ADMIN';

  const canCheck = useMemo(
    () => (capability: Capability) => can(role, capability),
    [role]
  );

  return {
    role,
    can: canCheck,
  };
}
