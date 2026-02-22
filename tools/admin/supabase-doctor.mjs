#!/usr/bin/env node
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID } = getAdminEnv();

const toHost = (value) => {
  if (!value) return "<missing>";
  try {
    return new URL(value).host;
  } catch {
    return "<invalid>";
  }
};

const renderPresence = (value) => (value ? "set" : "<missing>");

const rows = [
  ["VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL ?? "<missing>"],
  ["VITE_SUPABASE_ANON_KEY", renderPresence(process.env.VITE_SUPABASE_ANON_KEY)],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", renderPresence(process.env.VITE_SUPABASE_PUBLISHABLE_KEY)],
  ["SUPABASE_URL", toHost(SUPABASE_URL)],
  ["SUPABASE_SERVICE_ROLE_KEY", renderPresence(SUPABASE_SERVICE_ROLE_KEY)],
  ["TENANT_ID", TENANT_ID ?? "<missing>"],
];

for (const [key, value] of rows) {
  console.log(`${key}=${value}`);
}

process.exit(0);
