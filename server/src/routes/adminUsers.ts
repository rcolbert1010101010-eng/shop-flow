import { Router, type Request, type Response } from "express";

const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
const { randomBytes } = require("crypto") as typeof import("crypto");

type InviteBody = {
  email?: string;
  role_key?: string;
  full_name?: string;
};

export const adminUsersRouter = Router();

function normalizeErrorMessage(input: unknown): string {
  return String((input as any)?.message ?? input ?? "").toLowerCase();
}

function isInvalidEmailMessage(message: string): boolean {
  return message.includes("invalid email");
}

function isInvalidApiKeyMessage(message: string): boolean {
  return message.includes("invalid api key") || (message.includes("apikey") && message.includes("invalid"));
}

function isAlreadyRegisteredMessage(message: string): boolean {
  return message.includes("already been registered");
}

function isEmailRateLimitMessage(message: string): boolean {
  return message.includes("email rate limit exceeded");
}

function isDuplicateError(error: any): boolean {
  const message = normalizeErrorMessage(error);
  return error?.code === "23505" || message.includes("duplicate key") || message.includes("already exists");
}

function shouldFallbackToInsert(error: any): boolean {
  const message = normalizeErrorMessage(error);
  return message.includes("on conflict") || message.includes("unique") || message.includes("constraint");
}

function generateTempPassword(minLength = 24): string {
  const raw = randomBytes(64).toString("base64url").replace(/[^A-Za-z0-9]/g, "");
  const seeded = `A1${raw}`;
  if (seeded.length >= minLength) {
    return seeded.slice(0, minLength);
  }
  return `${seeded}${randomBytes(32).toString("hex")}`.slice(0, minLength);
}

function errorJson(res: Response, status: number, error: string, message?: string) {
  return res.status(status).json({
    ok: false,
    error,
    message,
    rid: res.locals?.rid,
  });
}

function badRequest(res: Response, code: string, message: string, details?: unknown) {
  const rid = res.locals?.rid;
  const mergedDetails =
    details === undefined
      ? { reason: code }
      : typeof details === "object" && details !== null
        ? { reason: code, ...(details as Record<string, unknown>) }
        : { reason: code, details };

  return res.status(400).type("application/json").json({
    ok: false,
    error: "bad_request",
    message,
    details: mergedDetails,
    rid,
  });
}

function logInvite400(
  req: Request,
  res: Response,
  reason: string,
  email: string | undefined,
  roleKey: string | undefined,
  tenantId: string | undefined
) {
  const bodyKeys =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? Object.keys(req.body as Record<string, unknown>)
      : [];
  console.warn("ADMIN_INVITE_400", {
    rid: res.locals?.rid,
    reason,
    email,
    role_key: roleKey,
    tenantId,
    bodyKeys,
  });
}

const tableColumnsCache = new Map<string, Set<string>>();

async function getTableColumns(supabaseAdmin: ReturnType<typeof createClient>, tableName: string): Promise<Set<string>> {
  const cacheKey = tableName.toLowerCase();
  const cached = tableColumnsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const { data, error } = await supabaseAdmin
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (error || !data) {
      const fallback = new Set<string>(["tenant_id", "user_id"]);
      tableColumnsCache.set(cacheKey, fallback);
      return fallback;
    }

    const columns = new Set<string>(
      data
        .map((row: any) => String(row?.column_name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    if (columns.size === 0) {
      const fallback = new Set<string>(["tenant_id", "user_id"]);
      tableColumnsCache.set(cacheKey, fallback);
      return fallback;
    }

    tableColumnsCache.set(cacheKey, columns);
    return columns;
  } catch {
    const fallback = new Set<string>(["tenant_id", "user_id"]);
    tableColumnsCache.set(cacheKey, fallback);
    return fallback;
  }
}

async function resolveAuthUserIdByEmail(
  sb: ReturnType<typeof createClient>,
  email: string
): Promise<{ userId: string | null; error: any | null }> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 100, page });
    if (error) {
      return { userId: null, error };
    }
    const users = data?.users ?? [];
    const match = users.find((u: any) => String(u?.email || "").trim().toLowerCase() === email);
    if (match?.id) {
      return { userId: match.id, error: null };
    }
    if (users.length < 100) {
      break;
    }
  }

  return { userId: null, error: null };
}

adminUsersRouter.post("/users/invite", async (req: Request, res: Response) => {
  try {
    const tenantId = String(res.locals.tenantId || "").trim();
    if (!tenantId) {
      logInvite400(req, res, "missing_tenant_id", undefined, undefined, tenantId || undefined);
      return badRequest(res, "missing_tenant_id", "X-Tenant-Id header is required");
    }

    const body = (req.body ?? {}) as InviteBody;
    const emailNorm = String(body.email ?? "").trim().toLowerCase();
    const roleKeyProvided = (req.body?.role_key ?? "").toString().trim();
    const roleKey = roleKeyProvided.toUpperCase();
    const _fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

    if (!emailNorm || !emailNorm.includes("@")) {
      logInvite400(req, res, "invalid_email", emailNorm, roleKey || undefined, tenantId);
      return badRequest(res, "invalid_email", "email is required");
    }
    if (!roleKey) {
      logInvite400(req, res, "invalid_role_key", emailNorm, roleKeyProvided || undefined, tenantId);
      return badRequest(res, "invalid_role_key", "invalid_role_key");
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceRoleKey) {
      return errorJson(
        res,
        500,
        "missing_env",
        "SUPABASE_URL (or SUPABASE_PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE) are required"
      );
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // full_name is accepted in request but intentionally not persisted until
    // a supported name column exists on public.profiles.
    void _fullName;
    const inviteOptions: Record<string, any> = {};
    const { data: inviteData, error: inviteError } = await sb.auth.admin.inviteUserByEmail(emailNorm, inviteOptions);

    let userId: string | null = null;
    let invited = false;
    let created = false;
    let tempPassword: string | null = null;

    if (inviteError) {
      const inviteErrorMessage = normalizeErrorMessage(inviteError);
      if (isAlreadyRegisteredMessage(inviteErrorMessage)) {
        const resolved = await resolveAuthUserIdByEmail(sb, emailNorm);
        if (resolved.error) {
          const resolveErrorMessage = normalizeErrorMessage(resolved.error);
          if (isInvalidApiKeyMessage(resolveErrorMessage)) {
            return errorJson(res, 502, "upstream_auth_failed", resolved.error.message);
          }
          throw new Error(resolved.error.message);
        }
        if (!resolved.userId) {
          return errorJson(res, 502, "upstream_auth_failed", "user exists but could not be resolved by email");
        }
        userId = resolved.userId;
        invited = false;
        created = false;
        tempPassword = null;
      } else if (isEmailRateLimitMessage(inviteErrorMessage)) {
        const generatedPassword = generateTempPassword(24);
        const { data: createdData, error: createError } = await sb.auth.admin.createUser({
          email: emailNorm,
          password: generatedPassword,
          email_confirm: true,
        });
        if (createError) {
          const createErrorMessage = normalizeErrorMessage(createError);
          if (isInvalidEmailMessage(createErrorMessage)) {
            logInvite400(req, res, "invalid_email", emailNorm, roleKey || undefined, tenantId);
            return badRequest(res, "invalid_email", "invalid email", createError.message);
          }
          if (isInvalidApiKeyMessage(createErrorMessage)) {
            return errorJson(res, 502, "upstream_auth_failed", createError.message);
          }
          throw new Error(createError.message);
        }
        userId = createdData?.user?.id ?? null;
        if (!userId) {
          throw new Error("create_user_succeeded_but_no_user_id_returned");
        }
        invited = false;
        created = true;
        tempPassword = process.env.NODE_ENV === "production" ? null : generatedPassword;
        console.warn("ADMIN_INVITE_EMAIL_RATE_LIMITED", { user_id: userId, tenant_id: tenantId });
      } else if (isInvalidEmailMessage(inviteErrorMessage)) {
        logInvite400(req, res, "invalid_email", emailNorm, roleKey || undefined, tenantId);
        return badRequest(res, "invalid_email", "invalid email", inviteError.message);
      } else if (isInvalidApiKeyMessage(inviteErrorMessage)) {
        return errorJson(res, 502, "upstream_auth_failed", inviteError.message);
      } else {
        throw new Error(inviteError.message);
      }
    } else {
      userId = inviteData?.user?.id ?? null;
      invited = true;
      created = false;
      tempPassword = null;
    }

    if (!userId) {
      throw new Error("Invite succeeded but no user id was returned");
    }

    const profilePayload: Record<string, any> = {
      id: userId,
      active_tenant_id: tenantId,
      must_change_password: true,
    };

    const { error: profileError } = await sb.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      return errorJson(
        res,
        500,
        "profiles_upsert_failed",
        `${profileError.message} (payload_keys=${Object.keys(profilePayload).join(",")})`
      );
    }

    const tenantUsersColumns = await getTableColumns(sb, "tenant_users");
    const tenantUserBase: Record<string, any> = { tenant_id: tenantId, user_id: userId };
    const tenantUserPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(tenantUserBase)) {
      if (tenantUsersColumns.has(key)) {
        tenantUserPayload[key] = value;
      }
    }

    const hasTenantAndUser = tenantUsersColumns.has("tenant_id") && tenantUsersColumns.has("user_id");
    const onConflict = hasTenantAndUser ? "tenant_id,user_id" : undefined;

    let tenantUsersError: any = null;
    if (Object.keys(tenantUserPayload).length === 0) {
      tenantUsersError = new Error("tenant_users payload is empty after column filtering");
    } else {
      const upsertResult = await sb
        .from("tenant_users")
        .upsert(tenantUserPayload, onConflict ? { onConflict } : undefined);
      tenantUsersError = upsertResult.error ?? null;

      if (tenantUsersError && shouldFallbackToInsert(tenantUsersError)) {
        const insertResult = await sb.from("tenant_users").insert(tenantUserPayload);
        if (!insertResult.error || isDuplicateError(insertResult.error)) {
          tenantUsersError = null;
        } else {
          tenantUsersError = insertResult.error;
        }
      }
    }

    if (tenantUsersError) {
      throw new Error(
        `tenant_users_upsert_failed: ${tenantUsersError.message}; tenant_users_columns=[${Array.from(tenantUsersColumns).sort().join(",")}]`
      );
    }

    const { data: roleRowExact, error: roleErrExact } = await sb
      .from("roles")
      .select("id,key")
      .eq("key", roleKey)
      .maybeSingle();
    if (roleErrExact) {
      throw new Error(`roles_lookup_failed: ${roleErrExact.message}`);
    }

    let roleRowCI: { id: string; key: string } | null = null;
    if (!roleRowExact) {
      const { data: roleRowCIData, error: roleErrCI } = await sb
        .from("roles")
        .select("id,key")
        .ilike("key", roleKey)
        .maybeSingle();
      if (roleErrCI) {
        throw new Error(`roles_lookup_failed: ${roleErrCI.message}`);
      }
      roleRowCI = (roleRowCIData as { id: string; key: string } | null) ?? null;
    }

    if (!roleRowExact && !roleRowCI) {
      const { data: validRolesData, error: validRolesError } = await sb.from("roles").select("key").order("key", {
        ascending: true,
      });
      if (validRolesError) {
        throw new Error(`roles_lookup_failed: ${validRolesError.message}`);
      }
      const validRoleKeys = (validRolesData ?? [])
        .map((r: any) => String(r?.key || "").trim())
        .filter(Boolean);
      logInvite400(req, res, "invalid_role_key", emailNorm, roleKey || undefined, tenantId);
      return badRequest(res, "invalid_role_key", "invalid_role_key", {
        provided: roleKeyProvided,
        valid_role_keys: validRoleKeys,
      });
    }

    const roleRow = (roleRowExact ?? roleRowCI)!;
    console.info("ADMIN_INVITE_ROLE_RESOLVED", {
      rid: res.locals?.rid,
      roleKeyProvided,
      roleKeyEffective: roleRow.key,
      roleId: roleRow.id,
    });

    const { error: userRoleError } = await sb
      .from("user_roles")
      .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: "user_id" });
    if (userRoleError) {
      throw new Error(`user_roles_upsert_failed: ${userRoleError.message}`);
    }

    console.log("ADMIN_INVITE_SUCCESS", {
      email: emailNorm,
      user_id: userId,
      tenant_id: tenantId,
      role_key_provided: roleKeyProvided,
      role_key_effective: roleRow.key,
      invited,
      created,
    });

    const successResponse: Record<string, any> = {
      ok: true,
      user_id: userId,
      email: emailNorm,
      tenant_id: tenantId,
      role_key: roleRow.key,
      role_key_provided: roleKeyProvided,
      role_key_effective: roleRow.key,
      invited,
      created,
      rid: res.locals?.rid,
    };

    if (created && process.env.NODE_ENV !== "production") {
      successResponse.temp_password = tempPassword;
    }

    return res.status(200).json(successResponse);
  } catch (err: any) {
    console.error("ADMIN_INVITE_ERROR", {
      method: req.method,
      path: req.originalUrl,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return errorJson(res, 500, "admin_invite_failed", err?.message ?? String(err));
  }
});
