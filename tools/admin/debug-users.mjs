#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID } = getAdminEnv();

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const printSection = (label, payload) => {
  console.log(`=== ${label} ===`);
  console.log(JSON.stringify(payload, null, 2));
};

const safeSelect = async (label, fn) => {
  try {
    const result = await fn();
    if (result?.error) {
      printSection(label, result.error);
      return null;
    }
    printSection(label, result?.data ?? null);
    return result?.data ?? null;
  } catch (err) {
    printSection(label, { error: String(err) });
    return null;
  }
};

const tenantRow = await safeSelect("tenants", async () => {
  return admin.from("tenants").select("id,name").eq("id", TENANT_ID).maybeSingle();
});

const tenantUsers = await safeSelect("tenant_users", async () => {
  return admin.from("tenant_users").select("*").eq("tenant_id", TENANT_ID).limit(50);
});

const userIds = Array.isArray(tenantUsers)
  ? tenantUsers.map((row) => row?.user_id).filter(Boolean)
  : [];

await safeSelect("profiles", async () => {
  if (userIds.length === 0) return { data: [], error: null };
  return admin.from("profiles").select("*").in("id", userIds).limit(50);
});

await safeSelect("user_roles", async () => {
  if (userIds.length === 0) return { data: [], error: null };
  return admin.from("user_roles").select("*").in("user_id", userIds).limit(50);
});

await safeSelect("roles", async () => {
  return admin.from("roles").select("*").limit(50);
});
