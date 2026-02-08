import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Role } from '@/security/rbac';

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
  mustChangePassword?: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
  setMustChangePassword: (value: boolean) => void;
};

const loadProfile = async (userId: string, set: (state: Partial<AuthState>) => void) => {
  if (!supabase) {
    set({ profile: null });
    return;
  }

  let roleKey: string | null | undefined = null;
  let mustChangePassword = false;

  const { data: userRoleRow, error: userRoleError } = await supabase
    .from('user_roles')
    .select('roles!inner(key)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!userRoleError) {
    roleKey = (userRoleRow as any)?.roles?.key ?? null;
  }

  const { data: legacyProfile, error: legacyProfileError } = await supabase
    .from('profiles')
    .select('role,must_change_password')
    .eq('id', userId)
    .maybeSingle();
  if (!roleKey) {
    if (!legacyProfileError) {
      roleKey = (legacyProfile as any)?.role ?? null;
    }
  }
  if (!legacyProfileError) {
    mustChangePassword = !!(legacyProfile as any)?.must_change_password;
  }

  const mappedRole = mapDbRoleKeyToRole(roleKey);
  set({ profile: { id: userId, role: mappedRole, roleKey, mustChangePassword } });
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
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
        await loadProfile(session.user.id, set);
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
          void loadProfile(userId, set);
        }, 0);
      } else {
        set({ profile: null });
      }
    });
  },

  loadProfile: async (userId: string) => {
    await loadProfile(userId, set);
  },
  setMustChangePassword: (value: boolean) => {
    set((state) => ({
      profile: state.profile ? { ...state.profile, mustChangePassword: value } : state.profile,
    }));
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
      await loadProfile(data.session.user.id, set);
    }
  },

  signOut: async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
