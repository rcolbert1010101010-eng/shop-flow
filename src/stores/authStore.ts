import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Role } from '@/security/rbac';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuidLike = (value: string | null | undefined): boolean => Boolean(value && UUID_RE.test(value.trim()));
const DEV_TENANT_DEBUG = Boolean((import.meta as any).env?.DEV);
const debugTenant = (...args: unknown[]) => {
  if (DEV_TENANT_DEBUG) {
    console.debug('[tenant-init]', ...args);
  }
};

const mapDbRoleKeyToRole = (key?: string | null): Role => {
  if (!key) return 'TECH';
  const normalized = key.toLowerCase();
  // Legacy profiles may store uppercase Role enum values; normalize before mapping
  switch (normalized) {
    case 'admin':
      return 'ADMIN';
    case 'manager':
      return 'MANAGER';
    case 'service_writer':
      return 'SERVICE_WRITER';
    case 'parts_manager':
      return 'PARTS';
    case 'sales_counter':
      return 'SERVICE_WRITER';
    case 'technician':
      return 'TECH';
    case 'guest':
    default:
      return 'TECH';
  }
};

type Profile = {
  id: string;
  role: Role;
  roleKey?: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  activeTenantId: string | null;
  tenantLoading: boolean;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
  ensureActiveTenant: (userId?: string) => Promise<string | null>;
};

const loadProfile = async (
  userId: string,
  set: (state: Partial<AuthState>) => void,
  get: () => AuthState
) => {
  if (!supabase) {
    set({ profile: null });
    return;
  }

  const storeTenantId = String(get().activeTenantId || '').trim();
  let activeTenantId: string | null = isUuidLike(storeTenantId) ? storeTenantId : null;
  let legacyProfileRoleKey: string | null = null;

  if (!activeTenantId) {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('active_tenant_id,role')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      debugTenant('profiles role/tenant lookup failed', { message: profileError.message });
    } else {
      const profileTenantId = String((profileRow as any)?.active_tenant_id || '').trim();
      if (isUuidLike(profileTenantId)) {
        activeTenantId = profileTenantId;
      }
      const rawProfileRole = String((profileRow as any)?.role || '').trim();
      legacyProfileRoleKey = rawProfileRole || null;
    }
  }

  if (!activeTenantId) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from('tenant_users')
      .select('tenant_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (membershipError) {
      debugTenant('tenant_users active tenant fallback failed', { message: membershipError.message });
    } else {
      const fallbackTenantId = String((membershipRows ?? [])[0]?.tenant_id || '').trim();
      if (isUuidLike(fallbackTenantId)) {
        activeTenantId = fallbackTenantId;
      }
    }
  }

  let membershipRoleRaw: string | null = null;
  if (activeTenantId) {
    const { data: membershipRow, error: membershipRoleError } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', activeTenantId)
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipRoleError) {
      debugTenant('tenant_users role lookup failed', { message: membershipRoleError.message });
    } else {
      const rawRole = String((membershipRow as any)?.role || '').trim();
      membershipRoleRaw = rawRole || null;
    }
  }

  // Minimal legacy fallback for environments where membership role cannot be resolved.
  if (!legacyProfileRoleKey) {
    const { data: legacyProfile, error: legacyProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (!legacyProfileError) {
      const rawLegacyRole = String((legacyProfile as any)?.role || '').trim();
      legacyProfileRoleKey = rawLegacyRole || null;
    }
  }

  const resolvedRoleKey = membershipRoleRaw ?? legacyProfileRoleKey;
  const normalizedRoleKey = resolvedRoleKey ? resolvedRoleKey.toLowerCase() : null;
  const mappedRole = mapDbRoleKeyToRole(normalizedRoleKey);

  set({
    profile: { id: userId, role: mappedRole, roleKey: resolvedRoleKey },
    activeTenantId: activeTenantId ?? get().activeTenantId,
  });
};

let tenantInitPromise: Promise<string | null> | null = null;
let tenantInitUserId: string | null = null;

const ensureActiveTenantForUser = async (
  userId: string,
  set: (state: Partial<AuthState>) => void
): Promise<string | null> => {
  if (!supabase) {
    set({ activeTenantId: null, tenantLoading: false });
    return null;
  }

  set({ tenantLoading: true });
  try {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('active_tenant_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      debugTenant('profiles.active_tenant_id lookup failed', { message: profileError.message });
    }

    const currentActiveTenantId = String((profileRow as any)?.active_tenant_id || '').trim();
    if (isUuidLike(currentActiveTenantId)) {
      set({ activeTenantId: currentActiveTenantId });
      return currentActiveTenantId;
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from('tenant_users')
      .select('tenant_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (membershipError) {
      debugTenant('tenant_users membership lookup failed', { message: membershipError.message });
      set({ activeTenantId: null });
      return null;
    }

    const firstMembershipTenantId = String((membershipRows ?? [])[0]?.tenant_id || '').trim();
    if (!isUuidLike(firstMembershipTenantId)) {
      set({ activeTenantId: null });
      return null;
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ active_tenant_id: firstMembershipTenantId })
      .eq('id', userId);

    if (profileUpdateError) {
      const { error: profileUpsertError } = await supabase
        .from('profiles')
        .upsert({ id: userId, active_tenant_id: firstMembershipTenantId }, { onConflict: 'id' });
      if (profileUpsertError) {
        debugTenant('active_tenant_id persistence failed', {
          update: profileUpdateError.message,
          upsert: profileUpsertError.message,
        });
      }
    }

    set({ activeTenantId: firstMembershipTenantId });
    return firstMembershipTenantId;
  } finally {
    set({ tenantLoading: false });
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  activeTenantId: null,
  tenantLoading: false,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    if (!supabase) {
      set({ loading: false });
      return;
    }

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });

    // Load profile if user exists
    if (session?.user) {
      try {
        await Promise.all([
          loadProfile(session.user.id, set, get),
          ensureActiveTenantForUser(session.user.id, set),
        ]);
      } catch {
        // ignore profile load errors
      }
    }

    set({ loading: false });

    // Listen for auth changes
    set({ initialized: true });
    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null });
      
      if (session?.user) {
        const userId = session.user.id;
        setTimeout(() => {
          void loadProfile(userId, set, get);
          void get().ensureActiveTenant(userId);
        }, 0);
      } else {
        set({ profile: null, activeTenantId: null, tenantLoading: false });
      }
    });
  },

  loadProfile: async (userId: string) => {
    await loadProfile(userId, set, get);
  },

  ensureActiveTenant: async (userId?: string) => {
    const resolvedUserId = String(userId || get().user?.id || '').trim();
    if (!isUuidLike(resolvedUserId)) {
      set({ activeTenantId: null, tenantLoading: false });
      return null;
    }

    const existingTenantId = String(get().activeTenantId || '').trim();
    if (isUuidLike(existingTenantId)) {
      return existingTenantId;
    }

    if (tenantInitPromise && tenantInitUserId === resolvedUserId) {
      return await tenantInitPromise;
    }

    tenantInitUserId = resolvedUserId;
    tenantInitPromise = ensureActiveTenantForUser(resolvedUserId, set);
    try {
      return await tenantInitPromise;
    } finally {
      tenantInitPromise = null;
      tenantInitUserId = null;
    }
  },

  signIn: async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.session?.user) {
      await Promise.all([
        loadProfile(data.session.user.id, set, get),
        ensureActiveTenantForUser(data.session.user.id, set),
      ]);
    }
  },

  signOut: async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, activeTenantId: null, tenantLoading: false });
  },
}));
