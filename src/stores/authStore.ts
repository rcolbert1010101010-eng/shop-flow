import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Role } from '@/security/rbac';

type Profile = {
  id: string;
  role: Role;
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

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    // Fallback to TECH if profile is missing
    set({ profile: { id: userId, role: 'TECH' } });
    return;
  }

  set({ profile: { id: data.id, role: data.role as Role } });
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
