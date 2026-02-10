#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID } = getAdminEnv();

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const errors = [];
const summary = {
  tenant_id: TENANT_ID,
  tenant_users_count: 0,
  profiles_existing_count: 0,
  profiles_created_count: 0,
  profiles_updated_active_tenant_count: 0,
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

const pushError = (label, error) => {
  errors.push({ label, error: error ?? null });
  console.error(label);
  if (error) console.error(JSON.stringify(error, null, 2));
};

const { data: tenantUsers, error: tenantUsersError } = await admin
  .from("tenant_users")
  .select("user_id, role")
  .eq("tenant_id", TENANT_ID);

if (tenantUsersError) {
  pushError("tenant_users_fetch_failed", tenantUsersError);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(1);
}

const tenantUsersRows = tenantUsers ?? [];
summary.tenant_users_count = tenantUsersRows.length;

const userIds = tenantUsersRows.map((row) => row?.user_id).filter(Boolean);

const { data: profiles, error: profilesError } = await admin
  .from("profiles")
  .select("id, role, active_tenant_id")
  .in("id", userIds);

if (profilesError) {
  pushError("profiles_fetch_failed", profilesError);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(1);
}

const profilesRows = profiles ?? [];
summary.profiles_existing_count = profilesRows.length;

const profileById = new Map(profilesRows.map((row) => [row.id, row]));

for (const row of tenantUsersRows) {
  const userId = row?.user_id;
  if (!userId) continue;

  if (!profileById.has(userId)) {
    let payload = {
      id: userId,
      active_tenant_id: TENANT_ID,
      role: (row?.role ?? '').toString().trim().toUpperCase() || undefined,
    };

    let { error: insertError } = await admin.from("profiles").insert(payload);

    if (insertError && isMissingColumnError(insertError)) {
      const missingColumn = extractMissingColumn(insertError);
      if (missingColumn && missingColumn in payload) {
        const nextPayload = { ...payload };
        delete nextPayload[missingColumn];
        payload = nextPayload;
        ({ error: insertError } = await admin.from("profiles").insert(payload));
      }
    }

    if (insertError && isMissingColumnError(insertError)) {
      const nextPayload = { id: userId };
      ({ error: insertError } = await admin.from("profiles").insert(nextPayload));
    }

    if (insertError) {
      pushError(`profiles_insert_failed:${userId}`, insertError);
    } else {
      summary.profiles_created_count += 1;
      profileById.set(userId, { id: userId, active_tenant_id: payload.active_tenant_id ?? null });
    }
  }
}

for (const row of profileById.values()) {
  if (row?.id && !row?.active_tenant_id) {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ active_tenant_id: TENANT_ID })
      .eq("id", row.id);

    if (updateError) {
      if (!isMissingColumnError(updateError)) {
        pushError(`profiles_update_active_tenant_failed:${row.id}`, updateError);
      }
    } else {
      summary.profiles_updated_active_tenant_count += 1;
    }
  }
}

console.log(JSON.stringify(summary, null, 2));
