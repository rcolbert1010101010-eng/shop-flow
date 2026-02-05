import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
const BASE_GLOBAL = { headers: {} as Record<string, string> };
const noOpLock = async (
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<any>
) => await fn();

// Create client only if configured; otherwise export null (app uses Zustand mock repos)
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          lock: noOpLock,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'shopflow-auth',
        },
        global: {
          ...BASE_GLOBAL,
          headers: {
            ...(BASE_GLOBAL.headers ?? {}),
            'X-Client-Info': 'shopflow-web',
          },
        },
      })
    : null;
