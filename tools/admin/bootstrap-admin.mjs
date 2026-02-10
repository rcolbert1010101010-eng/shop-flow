#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID } = getAdminEnv();

const requiredEnv = ["EMAIL", "NEW_PASS"];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(", ")}. ` +
      "Set them and retry."
  );
  process.exit(1);
}

const { EMAIL, NEW_PASS } = process.env;

const actionsTaken = [];
const warnings = [];

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isMissingTableError = (error, tableName) => {
  const message = (error?.message || "").toLowerCase();
  if (error?.code === "42P01") return true;
  if (tableName && message.includes(`relation \"public.${tableName}\" does not exist`)) {
    return true;
  }
  if (tableName && message.includes(`relation \"${tableName}\" does not exist`)) {
    return true;
  }
  if (tableName && message.includes(`could not find the '${tableName}' table`)) {
    return true;
  }
  if (message.includes("schema cache") && message.includes("table")) return true;
  return false;
};

const extractMissingColumn = (error) => {
  const message = (error?.message || "").toLowerCase();
  const matchA = message.match(/column \"?([a-z0-9_]+)\"? does not exist/);
  if (matchA?.[1]) return matchA[1];
  const matchB = message.match(/could not find the '([a-z0-9_]+)' column/);
  if (matchB?.[1]) return matchB[1];
  const matchC = message.match(/column ([a-z0-9_]+) of relation/);
  if (matchC?.[1]) return matchC[1];
  return null;
};

const isMissingColumnError = (error) => {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("schema cache") && message.includes("column"))
  );
};

const isConflictConstraintError = (error) => {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("on conflict") ||
    message.includes("unique") ||
    message.includes("exclusion")
  );
};

const isUniqueViolation = (error) => {
  const message = (error?.message || "").toLowerCase();
  return error?.code === "23505" || message.includes("duplicate key value");
};

const logWarning = (message, error) => {
  warnings.push(message);
  console.warn(message);
  if (error) console.warn(JSON.stringify(error, null, 2));
};

const summary = {
  supabase_url: SUPABASE_URL,
  user_id: null,
  email: EMAIL,
  tenant_id: null,
  actions_taken: actionsTaken,
  warnings,
};

const finalize = (code) => {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(code);
};

const findOrCreateAuthUser = async () => {
  const targetEmail = EMAIL.toLowerCase();
  const perPage = 200;
  let page = 1;
  let foundUser = null;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error(JSON.stringify(error, null, 2));
      finalize(3);
    }

    const users = data?.users ?? [];
    const match = users.find(
      (user) => (user.email ?? "").toLowerCase() === targetEmail
    );

    if (match) {
      foundUser = match;
      break;
    }

    if (users.length === 0) {
      break;
    }

    page += 1;
  }

  if (!foundUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: NEW_PASS,
      email_confirm: true,
    });

    if (error) {
      console.error(JSON.stringify(error, null, 2));
      finalize(3);
    }

    foundUser = data?.user ?? null;
    actionsTaken.push("auth_user_created");
  } else {
    const { error } = await admin.auth.admin.updateUserById(foundUser.id, {
      password: NEW_PASS,
    });

    if (error) {
      console.error(JSON.stringify(error, null, 2));
      finalize(3);
    }

    actionsTaken.push("auth_password_updated");
  }

  if (!foundUser?.id) {
    logWarning("Auth user missing id after create/update.");
    finalize(3);
  }

  summary.user_id = foundUser.id;
  return foundUser;
};

const discoverTenantId = async () => {
  if (TENANT_ID) {
    summary.tenant_id = TENANT_ID;
    actionsTaken.push("tenant_id_from_env");
    return TENANT_ID;
  }

  let tenants = [];
  let { data, error } = await admin
    .from("tenants")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(5);

  if (error && isMissingColumnError(error)) {
    logWarning(
      "tenants.created_at column missing; retrying without ordering",
      error
    );
    ({ data, error } = await admin.from("tenants").select("id,name").limit(5));
  }

  if (error) {
    if (isMissingTableError(error, "tenants")) {
      logWarning("tenants table not found; cannot auto-discover TENANT_ID", error);
      tenants = [];
    } else {
      logWarning("Failed to query tenants; cannot auto-discover TENANT_ID", error);
      tenants = [];
    }
  } else {
    tenants = data ?? [];
  }

  if (tenants.length !== 1) {
    console.log("TENANT_ID required. Found tenants:");
    console.log(JSON.stringify(tenants, null, 2));
    warnings.push("tenant_id_missing_or_ambiguous");
    finalize(2);
  }

  summary.tenant_id = tenants[0].id;
  actionsTaken.push("tenant_id_discovered");
  return tenants[0].id;
};

const ensureProfile = async (userId) => {
  let payload = { id: userId, email: EMAIL };
  let profileAvailable = true;

  let { error } = await admin
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error && isMissingColumnError(error)) {
    const missingColumn = extractMissingColumn(error);
    if (missingColumn === "email") {
      logWarning("profiles.email column missing; retrying without email", error);
      payload = { id: userId };
      ({ error } = await admin.from("profiles").upsert(payload, { onConflict: "id" }));
    }
  }

  if (error) {
    if (isMissingTableError(error, "profiles")) {
      logWarning("profiles table not found; skipping profile upsert", error);
      profileAvailable = false;
    } else {
      logWarning("Failed to upsert profiles row", error);
      profileAvailable = false;
    }
  } else {
    actionsTaken.push("profile_upserted");
  }

  return profileAvailable;
};

const ensureTenantMembership = async (tenantId, userId) => {
  let payload = { tenant_id: tenantId, user_id: userId, role: "ADMIN" };
  let { error } = await admin
    .from("tenant_users")
    .upsert(payload, { onConflict: "tenant_id,user_id" });

  if (error && isMissingColumnError(error)) {
    const missingColumn = extractMissingColumn(error);
    if (missingColumn === "role") {
      logWarning("tenant_users.role column missing; retrying without role", error);
      payload = { tenant_id: tenantId, user_id: userId };
      ({ error } = await admin
        .from("tenant_users")
        .upsert(payload, { onConflict: "tenant_id,user_id" }));
    }
  }

  if (error && isConflictConstraintError(error)) {
    const { data: existing, error: selectError } = await admin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) {
      if (isMissingTableError(selectError, "tenant_users")) {
        logWarning("tenant_users table not found; skipping tenant membership", selectError);
        return;
      }
      logWarning("Failed to query tenant_users for membership", selectError);
      return;
    }

    if (existing?.user_id) {
      actionsTaken.push("tenant_membership_exists");
      return;
    }

    const { error: insertError } = await admin
      .from("tenant_users")
      .insert(payload);

    if (insertError && isMissingColumnError(insertError)) {
      const missingColumn = extractMissingColumn(insertError);
      if (missingColumn === "role") {
        logWarning("tenant_users.role column missing; inserting without role", insertError);
        payload = { tenant_id: tenantId, user_id: userId };
        const { error: retryError } = await admin
          .from("tenant_users")
          .insert(payload);
        if (retryError) {
          logWarning("Failed to insert tenant_users row", retryError);
          return;
        }
        actionsTaken.push("tenant_membership_inserted");
        return;
      }
    }

    if (insertError) {
      logWarning("Failed to insert tenant_users row", insertError);
      return;
    }

    actionsTaken.push("tenant_membership_inserted");
    return;
  }

  if (error) {
    if (isMissingTableError(error, "tenant_users")) {
      logWarning("tenant_users table not found; skipping tenant membership", error);
      return;
    }
    logWarning("Failed to ensure tenant membership", error);
    return;
  }

  actionsTaken.push("tenant_membership_ensured");
};

const ensureRoleAssignment = async (tenantId, userId) => {
  let roleId = null;
  let roleLookupError = null;

  let { data, error } = await admin
    .from("roles")
    .select("id,key,name")
    .eq("key", "ADMIN")
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    logWarning("roles.key column missing; falling back to name", error);
    ({ data, error } = await admin
      .from("roles")
      .select("id,key,name")
      .eq("name", "ADMIN")
      .maybeSingle());
  }

  if (error) {
    if (isMissingTableError(error, "roles")) {
      logWarning("roles table not found; skipping role assignment", error);
      return;
    }
    roleLookupError = error;
  } else if (data?.id) {
    roleId = data.id;
    actionsTaken.push("admin_role_found");
  }

  if (!roleId && roleLookupError) {
    logWarning("Failed to lookup ADMIN role", roleLookupError);
  }

  if (!roleId) {
    let payload = { key: "ADMIN", name: "ADMIN" };
    let insertResult = await admin.from("roles").insert(payload).select("id");
    let insertError = insertResult.error;

    if (insertError && isMissingColumnError(insertError)) {
      const missingColumn = extractMissingColumn(insertError);
      if (missingColumn === "key") {
        payload = { name: "ADMIN" };
      } else if (missingColumn === "name") {
        payload = { key: "ADMIN" };
      }
      insertResult = await admin.from("roles").insert(payload).select("id");
      insertError = insertResult.error;
    }

    if (insertError) {
      if (isMissingTableError(insertError, "roles")) {
        logWarning("roles table not found; skipping role assignment", insertError);
        return;
      }
      logWarning("Failed to insert ADMIN role", insertError);
      return;
    }

    const inserted = Array.isArray(insertResult.data)
      ? insertResult.data[0]
      : insertResult.data;
    roleId = inserted?.id ?? null;
    if (roleId) actionsTaken.push("admin_role_inserted");
  }

  if (!roleId) {
    logWarning("ADMIN role id missing; skipping user_roles assignment");
    return;
  }

  let rolePayload = { user_id: userId, role_id: roleId, tenant_id: tenantId };
  let roleInsert = await admin.from("user_roles").insert(rolePayload);
  let roleError = roleInsert.error;

  if (roleError && isMissingColumnError(roleError)) {
    const missingColumn = extractMissingColumn(roleError);
    if (missingColumn === "tenant_id") {
      logWarning("user_roles.tenant_id column missing; retrying without tenant_id", roleError);
      rolePayload = { user_id: userId, role_id: roleId };
      roleInsert = await admin.from("user_roles").insert(rolePayload);
      roleError = roleInsert.error;
    }
  }

  if (roleError) {
    if (isMissingTableError(roleError, "user_roles")) {
      logWarning("user_roles table not found; skipping role assignment", roleError);
      return;
    }
    if (isUniqueViolation(roleError)) {
      actionsTaken.push("user_role_exists");
      return;
    }
    logWarning("Failed to insert user_roles row", roleError);
    return;
  }

  actionsTaken.push("user_role_inserted");
};

const updateActiveTenant = async (tenantId, userId) => {
  const { error } = await admin
    .from("profiles")
    .update({ active_tenant_id: tenantId })
    .eq("id", userId);

  if (error) {
    if (isMissingTableError(error, "profiles")) {
      logWarning("profiles table not found; skipping active_tenant_id update", error);
      return;
    }
    if (isMissingColumnError(error)) {
      logWarning("profiles.active_tenant_id column missing; skipping update", error);
      return;
    }
    logWarning("Failed to update profiles.active_tenant_id", error);
    return;
  }

  actionsTaken.push("profile_active_tenant_set");
};

const user = await findOrCreateAuthUser();
const tenantId = await discoverTenantId();
const profileAvailable = await ensureProfile(user.id);
await ensureTenantMembership(tenantId, user.id);
await ensureRoleAssignment(tenantId, user.id);
if (profileAvailable) {
  await updateActiveTenant(tenantId, user.id);
}

finalize(0);
