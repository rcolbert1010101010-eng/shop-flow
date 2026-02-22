#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID } = getAdminEnv();

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const warnings = [];
const errors = [];
const summary = {
  tenant_id: TENANT_ID,
  tenant_users_count: 0,
  auth_emails_found_count: 0,
  user_profiles_upserted_count: 0,
  warnings,
  errors,
};

const isMissingColumnError = (error) => {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("schema cache") && message.includes("column"))
  );
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

const { data: tenantUsers, error: tenantUsersError } = await admin
  .from("tenant_users")
  .select("user_id, created_at")
  .eq("tenant_id", TENANT_ID);

if (tenantUsersError) {
  console.error(JSON.stringify(tenantUsersError, null, 2));
  process.exit(2);
}

const tenantUsersRows = tenantUsers ?? [];
summary.tenant_users_count = tenantUsersRows.length;

const findEmailById = async (userId) => {
  if (!userId) return null;

  if (admin.auth?.admin?.getUserById) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      errors.push({ label: `auth_getUserById_failed:${userId}`, error });
      return null;
    }
    return data?.user?.email ?? null;
  }

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      errors.push({ label: `auth_listUsers_failed:page_${page}`, error });
      return null;
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    const match = users.find((user) => user?.id === userId);
    if (match?.email) return match.email;
  }

  return null;
};

for (const row of tenantUsersRows) {
  const userId = row?.user_id;
  if (!userId) continue;

  const email = await findEmailById(userId);
  if (!email) {
    warnings.push(`Email not found for user_id=${userId}`);
    continue;
  }
  summary.auth_emails_found_count += 1;

  let payload = {
    id: userId,
    email,
    created_at: row?.created_at ?? null,
    is_active: true,
  };

  let { error: upsertError } = await admin
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" });

  if (upsertError && isMissingColumnError(upsertError)) {
    const missingColumn = extractMissingColumn(upsertError);
    if (missingColumn && missingColumn in payload) {
      const nextPayload = { ...payload };
      delete nextPayload[missingColumn];
      payload = nextPayload;
      ({ error: upsertError } = await admin
        .from("user_profiles")
        .upsert(payload, { onConflict: "id" }));
    }
  }

  if (upsertError && isMissingColumnError(upsertError)) {
    const nextPayload = { id: userId, email };
    ({ error: upsertError } = await admin
      .from("user_profiles")
      .upsert(nextPayload, { onConflict: "id" }));
  }

  if (upsertError) {
    errors.push({ label: `user_profiles_upsert_failed:${userId}`, error: upsertError });
  } else {
    summary.user_profiles_upserted_count += 1;
  }
}

console.log(JSON.stringify(summary, null, 2));

if (summary.tenant_users_count > 0 && summary.user_profiles_upserted_count > 0) {
  process.exit(0);
}

process.exit(2);
