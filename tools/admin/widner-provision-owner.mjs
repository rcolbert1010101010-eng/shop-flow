#!/usr/bin/env node
import fs from "fs";
import path from "path";
import process from "process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function resolveEnvPath(candidate) {
  if (path.isAbsolute(candidate)) return candidate;
  const repoRelative = path.resolve(repoRoot, candidate);
  if (fs.existsSync(repoRelative)) return repoRelative;
  return path.resolve(process.cwd(), candidate);
}

function loadProvisionEnv() {
  const selected = String(process.env.SHOPFLOW_ENV_FILE || "").trim() || ".env.widner.local";
  const envPath = resolveEnvPath(selected);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    return envPath;
  }
  return null;
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`missing_env_${name}`);
  }
  return value;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(value) {
  return value.includes("@");
}

async function findAuthUserByEmail(adminClient, email) {
  const target = normalizeEmail(email);
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth_list_users_failed: ${error.message}`);
    const users = data?.users ?? [];
    const found = users.find((user) => normalizeEmail(user.email) === target);
    if (found?.id) return found;
    if (users.length < perPage) break;
  }
  return null;
}

async function ensureTenant(adminClient, tenantName) {
  const { data: existingRows, error: existingError } = await adminClient
    .from("tenants")
    .select("id,name")
    .eq("name", tenantName)
    .limit(1);

  if (existingError) throw new Error(`tenant_lookup_failed: ${existingError.message}`);
  if ((existingRows ?? []).length > 0) {
    return { tenantId: existingRows[0].id, created: false };
  }

  const { data: insertedRows, error: insertError } = await adminClient
    .from("tenants")
    .insert({ name: tenantName })
    .select("id,name")
    .limit(1);

  if (insertError) {
    const { data: retryRows, error: retryError } = await adminClient
      .from("tenants")
      .select("id,name")
      .eq("name", tenantName)
      .limit(1);
    if (retryError) throw new Error(`tenant_lookup_retry_failed: ${retryError.message}`);
    if ((retryRows ?? []).length > 0) {
      return { tenantId: retryRows[0].id, created: false };
    }
    throw new Error(`tenant_insert_failed: ${insertError.message}`);
  }

  const tenantId = (insertedRows ?? [])[0]?.id;
  if (!tenantId) throw new Error("tenant_insert_failed: missing_tenant_id");
  return { tenantId, created: true };
}

async function ensureAuthUser(adminClient, ownerEmail, ownerPassword, ownerFullName) {
  const existingUser = await findAuthUserByEmail(adminClient, ownerEmail);
  if (existingUser?.id) {
    return { userId: existingUser.id, created: false };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: ownerFullName ? { full_name: ownerFullName } : undefined,
  });

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("already been registered")) {
      const resolved = await findAuthUserByEmail(adminClient, ownerEmail);
      if (resolved?.id) {
        return { userId: resolved.id, created: false };
      }
    }
    throw new Error(`owner_auth_create_failed: ${error.message}`);
  }

  const userId = data?.user?.id;
  if (!userId) throw new Error("owner_auth_create_failed: missing_user_id");
  return { userId, created: true };
}

async function upsertProfile(adminClient, userId, tenantId) {
  const payload = {
    id: userId,
    active_tenant_id: tenantId,
    must_change_password: false,
  };
  const { error } = await adminClient.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`profile_upsert_failed: ${error.message}`);
}

async function upsertTenantMembership(adminClient, tenantId, userId) {
  const payload = {
    tenant_id: tenantId,
    user_id: userId,
    role: "admin",
    is_active: true,
  };
  const { error } = await adminClient
    .from("tenant_users")
    .upsert(payload, { onConflict: "tenant_id,user_id" });
  if (error) throw new Error(`tenant_membership_upsert_failed: ${error.message}`);
}

async function main() {
  const loadedEnvPath = loadProvisionEnv();
  if (loadedEnvPath) {
    console.log(`[widner] loaded env file: ${path.relative(repoRoot, loadedEnvPath)}`);
  } else {
    console.log("[widner] no env file loaded from SHOPFLOW_ENV_FILE/.env.widner.local; using process env");
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ownerEmail = normalizeEmail(requireEnv("WIDNER_OWNER_EMAIL"));
  const ownerPassword = requireEnv("WIDNER_OWNER_PASSWORD");
  const ownerFullName = String(process.env.WIDNER_OWNER_FULL_NAME || "").trim();
  const tenantName = String(process.env.WIDNER_TENANT_NAME || "Widner").trim() || "Widner";

  if (!supabaseUrl) throw new Error("missing_env_SUPABASE_URL");
  if (!validateEmail(ownerEmail)) throw new Error("invalid_env_WIDNER_OWNER_EMAIL");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenant = await ensureTenant(adminClient, tenantName);
  const owner = await ensureAuthUser(adminClient, ownerEmail, ownerPassword, ownerFullName);
  await upsertProfile(adminClient, owner.userId, tenant.tenantId);
  await upsertTenantMembership(adminClient, tenant.tenantId, owner.userId);

  console.log("");
  console.log("Widner owner provisioning complete.");
  console.log(`tenant_id: ${tenant.tenantId}`);
  console.log(`owner_user_id: ${owner.userId}`);
  console.log(`owner_email: ${ownerEmail}`);
  console.log("");
  console.log("Next steps:");
  console.log("1) npm run dev:widner");
  console.log(`2) Log in with ${ownerEmail}`);
}

main().catch((error) => {
  console.error("widner_provision_failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
