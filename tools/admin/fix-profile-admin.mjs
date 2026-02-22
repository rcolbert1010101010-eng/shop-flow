#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getAdminEnv();

const requiredEnv = ["USER_ID"];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}. Set them and retry.`);
  process.exit(1);
}

const { USER_ID } = process.env;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let profilesRoleAfter = null;
let tenantUsersRoleNormalized = false;

const { error: updateProfileError } = await admin
  .from("profiles")
  .update({ role: "ADMIN" })
  .eq("id", USER_ID);

if (updateProfileError) {
  console.error(JSON.stringify(updateProfileError, null, 2));
  process.exit(1);
}

const { data: profileRow, error: profileSelectError } = await admin
  .from("profiles")
  .select("id, role, active_tenant_id")
  .eq("id", USER_ID)
  .maybeSingle();

if (profileSelectError) {
  console.error(JSON.stringify(profileSelectError, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(profileRow ?? null, null, 2));
profilesRoleAfter = profileRow?.role ?? null;

const { error: tenantRoleError } = await admin
  .from("tenant_users")
  .update({ role: "admin" })
  .eq("user_id", USER_ID);

if (tenantRoleError) {
  console.warn("Failed to normalize tenant_users.role");
  console.warn(JSON.stringify(tenantRoleError, null, 2));
} else {
  tenantUsersRoleNormalized = true;
}

const summary = {
  user_id: USER_ID,
  profiles_role_after: profilesRoleAfter,
  tenant_users_role_normalized: tenantUsersRoleNormalized,
};

console.log(JSON.stringify(summary, null, 2));
