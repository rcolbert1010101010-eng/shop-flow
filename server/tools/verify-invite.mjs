#!/usr/bin/env node

const baseUrl = (process.env.SHOPFLOW_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
const adminKey = process.env.SHOPFLOW_ADMIN_API_KEY || "";
const tenantId = process.env["X-Tenant-Id"] || process.env.X_TENANT_ID || process.env.TENANT_ID || "";
const email = String(process.env.VERIFY_INVITE_EMAIL || `verify+${Date.now()}@shopflow.local`)
  .trim()
  .toLowerCase();
const roleKey = String(process.env.VERIFY_INVITE_ROLE_KEY || "TECHNICIAN")
  .trim()
  .toUpperCase();

function fail(message, details) {
  console.error("FAIL", message);
  if (details !== undefined) {
    console.error(typeof details === "string" ? details : JSON.stringify(details, null, 2));
  }
  process.exit(1);
}

async function callInvite() {
  const response = await fetch(`${baseUrl}/api/v1/admin/users/invite`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopflow-admin-key": adminKey,
      "X-Tenant-Id": tenantId,
    },
    body: JSON.stringify({
      email,
      role_key: roleKey,
      full_name: "ShopFlow Verify Invite",
    }),
  });

  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    okHttp: response.ok,
    json,
    raw,
  };
}

(async () => {
  if (!adminKey) {
    fail("Missing SHOPFLOW_ADMIN_API_KEY env");
  }
  if (!tenantId) {
    fail("Missing tenant id env. Set X-Tenant-Id or X_TENANT_ID or TENANT_ID");
  }
  if (!email.includes("@")) {
    fail("VERIFY_INVITE_EMAIL is invalid", { email });
  }

  try {
    const first = await callInvite();
    const second = await callInvite();

    if (!first.okHttp || first.json?.ok !== true) {
      fail("First invite call failed", first);
    }
    if (!second.okHttp || second.json?.ok !== true) {
      fail("Second invite call failed", second);
    }

    console.log("PASS verify-invite");
    console.log(
      JSON.stringify(
        {
          email,
          tenant_id: tenantId,
          first: {
            status: first.status,
            invited: first.json?.invited,
            created: first.json?.created,
            user_id: first.json?.user_id,
            rid: first.json?.rid,
          },
          second: {
            status: second.status,
            invited: second.json?.invited,
            created: second.json?.created,
            user_id: second.json?.user_id,
            rid: second.json?.rid,
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    fail("Unexpected error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
  }
})();
