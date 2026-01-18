import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Role } from '@/security/rbac';

const mapDbRoleKeyToRole = (key?: string | null): Role => {
  switch (key) {
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
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
};

const loadProfile = async (userId: string, set: (state: Partial<AuthState>) => void) => {
  if (!supabase) {
    set({ profile: null });
    return;
  }

  let roleKey: string | null | undefined = null;

  const { data: userRoleRow } = await supabase
    .from('user_roles')
    .select('roles!inner(key)')
    .eq('user_id', userId)
    .maybeSingle();

  roleKey = (userRoleRow as any)?.roles?.key ?? null;

  if (!roleKey) {
    const { data: legacyProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    roleKey = (legacyProfile as any)?.role ?? null;
  }

  const mappedRole = mapDbRoleKeyToRole(roleKey);
  set({ profile: { id: userId, role: mappedRole, roleKey } });
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
      await loadProfile(session.user.id, set);
    }

    set({ loading: false });

    // Listen for auth changes
    set({ initialized: true });
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });
      
      if (session?.user) {
        await loadProfile(session.user.id, set);
      } else {
        set({ profile: null });
      }
    });
  },

  loadProfile: async (userId: string) => {
    await loadProfile(userId, set);
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
