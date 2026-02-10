#!/usr/bin/env node
import fs from "fs";
import path from "path";
import process from "process";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const envPath = path.join(repoRoot, ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const ACCESS_TOKEN = (process.env.ACCESS_TOKEN ?? "").toString().trim();
const TENANT_ID_ENV = (process.env.TENANT_ID ?? "").toString().trim();
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").toString().trim();
const ANON_KEY =
  (process.env.VITE_SUPABASE_ANON_KEY ?? "").toString().trim() ||
  (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").toString().trim();

console.log("RLS smoke test for Users");
console.log("Requires ACCESS_TOKEN env var. TENANT_ID optional.");

if (!ACCESS_TOKEN) {
  console.error("Missing ACCESS_TOKEN.");
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error("Missing VITE_SUPABASE_URL (from .env.local or env).");
  process.exit(1);
}
if (!ANON_KEY) {
  console.error("Missing VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let useFetchFallback = false;
if (supabase.auth?.setSession) {
  try {
    const { error } = await supabase.auth.setSession({
      access_token: ACCESS_TOKEN,
      refresh_token: "dummy",
    });
    if (error) {
      useFetchFallback = true;
    }
  } catch {
    useFetchFallback = true;
  }
} else {
  useFetchFallback = true;
}

console.log(`Auth session via SDK: ${useFetchFallback ? "failed (fallback fetch)" : "ok"}`);

const authHeaders = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  apikey: ANON_KEY,
  "Content-Type": "application/json",
};

const restGet = async (url, preferCount = false) => {
  const headers = { ...authHeaders };
  if (preferCount) headers.Prefer = "count=exact";
  const response = await fetch(url, { headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const range = response.headers.get("content-range") || "";
  const total = range.includes("/") ? Number(range.split("/").pop()) : null;
  return { ok: response.ok, status: response.status, data, total };
};

const restPost = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: response.ok, status: response.status, data };
};

const printSection = (label, value) => {
  console.log(`=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
};

let currentTenantId = null;
if (!useFetchFallback) {
  const { data, error } = await supabase.rpc("current_tenant_id");
  if (error) {
    printSection("rpc current_tenant_id error", {
      message: error.message,
      code: error.code ?? null,
    });
  } else {
    currentTenantId = data ?? null;
    printSection("rpc current_tenant_id", { tenant_id: currentTenantId });
  }
} else {
  const rpc = await restPost(`${SUPABASE_URL}/rest/v1/rpc/current_tenant_id`, {});
  if (!rpc.ok) {
    printSection("rpc current_tenant_id error", rpc.data);
  } else {
    currentTenantId = rpc.data ?? null;
    printSection("rpc current_tenant_id", { tenant_id: currentTenantId });
  }
}

const tenantId = TENANT_ID_ENV || currentTenantId;

let tenantUsers = [];
let tenantUsersCount = 0;

if (tenantId) {
  if (!useFetchFallback) {
    const { data, error } = await supabase
      .from("tenant_users")
      .select("tenant_id,user_id,role", { count: "exact" })
      .eq("tenant_id", tenantId)
      .limit(100);
    if (error) {
      printSection("tenant_users error", { message: error.message, code: error.code ?? null });
    } else {
      tenantUsers = data ?? [];
      tenantUsersCount = data?.length ?? 0;
      printSection("tenant_users", {
        count: tenantUsersCount,
        sample: tenantUsers.slice(0, 3),
      });
    }
  } else {
    const url = `${SUPABASE_URL}/rest/v1/tenant_users?tenant_id=eq.${tenantId}&select=tenant_id,user_id,role&limit=100`;
    const result = await restGet(url, true);
    if (!result.ok) {
      printSection("tenant_users error", result.data);
    } else {
      tenantUsers = Array.isArray(result.data) ? result.data : [];
      tenantUsersCount = result.total ?? tenantUsers.length;
      printSection("tenant_users", {
        count: tenantUsersCount,
        sample: tenantUsers.slice(0, 3),
      });
    }
  }
} else {
  printSection("tenant_users", { count: 0, sample: [] });
}

const memberIds = tenantUsers.map((row) => row?.user_id).filter(Boolean);

let userProfiles = [];
let userProfilesCount = 0;
if (memberIds.length > 0) {
  const ids = memberIds.slice(0, 50).join(",");
  if (!useFetchFallback) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,email,full_name,is_active", { count: "exact" })
      .in("id", memberIds)
      .limit(10);
    if (error) {
      printSection("user_profiles error", { message: error.message, code: error.code ?? null });
    } else {
      userProfiles = data ?? [];
      userProfilesCount = data?.length ?? 0;
      printSection("user_profiles", {
        count: userProfilesCount,
        sample: userProfiles.slice(0, 3),
      });
    }
  } else {
    const url = `${SUPABASE_URL}/rest/v1/user_profiles?select=id,email,full_name,is_active&id=in.(${ids})&limit=10`;
    const result = await restGet(url, true);
    if (!result.ok) {
      printSection("user_profiles error", result.data);
    } else {
      userProfiles = Array.isArray(result.data) ? result.data : [];
      userProfilesCount = result.total ?? userProfiles.length;
      printSection("user_profiles", {
        count: userProfilesCount,
        sample: userProfiles.slice(0, 3),
      });
    }
  }
} else {
  printSection("user_profiles", { count: 0, sample: [] });
}

let roleDistribution = {};
if (memberIds.length > 0) {
  const ids = memberIds.slice(0, 50).join(",");
  if (!useFetchFallback) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role:roles(key)")
      .in("user_id", memberIds)
      .limit(50);
    if (error) {
      printSection("user_roles error", { message: error.message, code: error.code ?? null });
    } else {
      (data ?? []).forEach((row) => {
        const key = row?.role?.key ?? "unknown";
        roleDistribution[key] = (roleDistribution[key] ?? 0) + 1;
      });
      printSection("user_roles distribution", roleDistribution);
    }
  } else {
    const url = `${SUPABASE_URL}/rest/v1/user_roles?select=user_id,role:roles(key)&user_id=in.(${ids})&limit=50`;
    const result = await restGet(url, false);
    if (!result.ok) {
      printSection("user_roles error", result.data);
    } else {
      (result.data ?? []).forEach((row) => {
        const key = row?.role?.key ?? "unknown";
        roleDistribution[key] = (roleDistribution[key] ?? 0) + 1;
      });
      printSection("user_roles distribution", roleDistribution);
    }
  }
} else {
  printSection("user_roles distribution", {});
}

let classification = "";
if (!currentTenantId) {
  classification = "ACTIVE TENANT BROKEN: current_tenant_id returned null";
} else if (tenantUsersCount === 0) {
  classification = "RLS BLOCKED: tenant_users not readable for tenant";
} else if (tenantUsersCount > 0 && userProfilesCount === 0) {
  classification = "DATA/RLS: user_profiles missing or not readable";
} else if (tenantUsersCount > 0 && userProfilesCount > 0) {
  classification = "RLS OK: frontend should see users; investigate frontend render/refetch";
} else {
  classification = "UNKNOWN: insufficient data";
}

console.log(classification);
