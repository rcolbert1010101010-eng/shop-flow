#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getAdminEnv();

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const summary = {
  admin_role_id: null,
  removed_duplicate_admin: false,
  user_roles_updated_count: 0,
  roles_deleted_count: 0,
  warnings: [],
};

const { data: roles, error: rolesError } = await admin
  .from("roles")
  .select("id,key,name")
  .in("key", ["admin", "ADMIN"]);

if (rolesError) {
  console.error(JSON.stringify(rolesError, null, 2));
  process.exit(2);
}

const adminLower = (roles ?? []).find((row) => row?.key === "admin");
const adminUpper = (roles ?? []).find((row) => row?.key === "ADMIN");

if (!adminLower?.id) {
  console.error("Missing roles row with key=admin");
  process.exit(2);
}

summary.admin_role_id = adminLower.id;

if (adminUpper?.id) {
  let beforeCount = null;
  let afterCount = null;

  const { error: beforeCountError, count: beforeCountValue } = await admin
    .from("user_roles")
    .select("role_id", { count: "exact", head: true })
    .eq("role_id", adminUpper.id);

  if (beforeCountError) {
    summary.warnings.push("Failed to count user_roles before update");
    console.error(JSON.stringify(beforeCountError, null, 2));
  } else {
    beforeCount = beforeCountValue ?? 0;
  }

  const { error: updateError } = await admin
    .from("user_roles")
    .update({ role_id: adminLower.id })
    .eq("role_id", adminUpper.id);

  if (updateError) {
    summary.warnings.push("Failed to update user_roles for duplicate ADMIN key");
    console.error(JSON.stringify(updateError, null, 2));
  }

  const { error: afterCountError, count: afterCountValue } = await admin
    .from("user_roles")
    .select("role_id", { count: "exact", head: true })
    .eq("role_id", adminUpper.id);

  if (afterCountError) {
    summary.warnings.push("Failed to count user_roles after update");
    console.error(JSON.stringify(afterCountError, null, 2));
  } else {
    afterCount = afterCountValue ?? 0;
  }

  if (beforeCount !== null && afterCount !== null) {
    summary.user_roles_updated_count = Math.max(0, beforeCount - afterCount);
  }

  const { error: deleteError, count: deletedCount } = await admin
    .from("roles")
    .delete({ count: "exact" })
    .eq("id", adminUpper.id);

  if (deleteError) {
    summary.warnings.push("Failed to delete duplicate ADMIN role row");
    console.error(JSON.stringify(deleteError, null, 2));
  } else {
    summary.roles_deleted_count = deletedCount ?? 0;
  }

  const { data: verifyData, error: verifyError } = await admin
    .from("roles")
    .select("id")
    .eq("id", adminUpper.id)
    .maybeSingle();

  if (verifyError) {
    summary.warnings.push("Failed to verify duplicate ADMIN role deletion");
    console.error(JSON.stringify(verifyError, null, 2));
  } else if (!verifyData) {
    summary.removed_duplicate_admin = true;
  }
}

console.log(JSON.stringify(summary, null, 2));
