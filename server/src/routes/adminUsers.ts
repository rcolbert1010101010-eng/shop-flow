import { Router, type Request, type Response } from "express";

const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
const { randomBytes } = require("crypto") as typeof import("crypto");

type InviteBody = {
  email?: string;
  role_key?: string;
  full_name?: string;
};

type MembershipAction = "deactivate" | "reactivate";

type MembershipStatusStrategy =
  | { kind: "boolean"; column: "is_active" | "active" }
  | { kind: "timestamp"; column: "deactivated_at" | "disabled_at" | "deleted_at" }
  | { kind: "none" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const adminUsersRouter = Router();

function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

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

async function getTableColumns(
  supabaseAdmin: ReturnType<typeof createClient>,
  tableName: string,
  fallbackColumns: string[] = []
): Promise<Set<string>> {
  const cacheKey = tableName.toLowerCase();
  const cached = tableColumnsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const fallback = new Set<string>(fallbackColumns.map((c) => c.toLowerCase()));

  try {
    const { data, error } = await supabaseAdmin
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (error || !data) {
      tableColumnsCache.set(cacheKey, fallback);
      return fallback;
    }

    const columns = new Set<string>(
      data
        .map((row: any) => String(row?.column_name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    if (columns.size === 0) {
      tableColumnsCache.set(cacheKey, fallback);
      return fallback;
    }

    tableColumnsCache.set(cacheKey, columns);
    return columns;
  } catch {
    tableColumnsCache.set(cacheKey, fallback);
    return fallback;
  }
}

function resolveMembershipStatusStrategy(columns: Set<string>): MembershipStatusStrategy {
  if (columns.has("is_active")) {
    return { kind: "boolean", column: "is_active" };
  }
  if (columns.has("active")) {
    return { kind: "boolean", column: "active" };
  }
  if (columns.has("deactivated_at")) {
    return { kind: "timestamp", column: "deactivated_at" };
  }
  if (columns.has("disabled_at")) {
    return { kind: "timestamp", column: "disabled_at" };
  }
  if (columns.has("deleted_at")) {
    return { kind: "timestamp", column: "deleted_at" };
  }
  return { kind: "none" };
}

function isMembershipActive(row: any, strategy: MembershipStatusStrategy): boolean {
  if (strategy.kind === "boolean") {
    return Boolean(row?.[strategy.column]);
  }
  if (strategy.kind === "timestamp") {
    return !row?.[strategy.column];
  }
  return true;
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

function getAdminClientOrError(res: Response):
  | { sb: ReturnType<typeof createClient>; errorResponse?: undefined }
  | { sb?: undefined; errorResponse: ReturnType<typeof errorJson> } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      errorResponse: errorJson(
        res,
        500,
        "missing_env",
        "SUPABASE_URL (or SUPABASE_PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE) are required"
      ),
    };
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { sb };
}

async function writeAuditLog(
  sb: ReturnType<typeof createClient>,
  payload: {
    tenantId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const auditColumns = await getTableColumns(sb, "audit_log", []);
  if (auditColumns.size === 0) {
    return;
  }

  if (!auditColumns.has("tenant_id") || !auditColumns.has("action") || !auditColumns.has("entity_type") || !auditColumns.has("entity_id")) {
    console.warn("AUDIT_LOG_SKIPPED", {
      reason: "missing_required_columns",
      columns: Array.from(auditColumns).sort(),
    });
    return;
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: payload.tenantId,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
  };

  if (auditColumns.has("actor_user_id") && payload.actorUserId && isUuid(payload.actorUserId)) {
    insertPayload.actor_user_id = payload.actorUserId;
  }
  if (auditColumns.has("details") && payload.details) {
    insertPayload.details = payload.details;
  }
  if (auditColumns.has("created_at")) {
    insertPayload.created_at = new Date().toISOString();
  }

  const { error } = await sb.from("audit_log").insert(insertPayload);
  if (error) {
    console.error("AUDIT_LOG_WRITE_FAILED", {
      message: error.message,
      action: payload.action,
      tenant_id: payload.tenantId,
      entity_id: payload.entityId,
      payload_keys: Object.keys(insertPayload),
    });
  }
}

async function fetchRoleKeyForUser(sb: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data, error } = await sb.from("user_roles").select("role:roles(key)").eq("user_id", userId).maybeSingle();
  if (error) {
    throw new Error(`role_lookup_failed: ${error.message}`);
  }
  const key = String((data as any)?.role?.key || "").trim();
  return key || null;
}

async function countActiveAdminIdsForTenant(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  strategy: MembershipStatusStrategy
): Promise<Set<string>> {
  const membershipSelect = strategy.kind === "none" ? "user_id" : `user_id,${strategy.column}`;
  const { data: membershipRows, error: membershipError } = await sb
    .from("tenant_users")
    .select(membershipSelect)
    .eq("tenant_id", tenantId);

  if (membershipError) {
    throw new Error(`tenant_membership_query_failed: ${membershipError.message}`);
  }

  const activeUserIds = (membershipRows ?? [])
    .filter((row: any) => isMembershipActive(row, strategy))
    .map((row: any) => String(row?.user_id || "").trim())
    .filter(Boolean);

  if (activeUserIds.length === 0) {
    return new Set<string>();
  }

  const { data: roleRows, error: roleError } = await sb
    .from("user_roles")
    .select("user_id, role:roles(key,is_active)")
    .in("user_id", activeUserIds);

  if (roleError) {
    throw new Error(`active_admin_count_failed: ${roleError.message}`);
  }

  const adminIds = new Set<string>();
  for (const row of roleRows ?? []) {
    const userId = String((row as any)?.user_id || "").trim();
    const roleKey = String((row as any)?.role?.key || "").trim().toUpperCase();
    const roleIsActive = (row as any)?.role?.is_active;
    if (!userId) continue;
    if (roleKey === "ADMIN" && roleIsActive !== false) {
      adminIds.add(userId);
    }
  }

  return adminIds;
}

async function handleMembershipLifecycle(req: Request, res: Response, action: MembershipAction) {
  try {
    const tenantId = String(res.locals.tenantId || "").trim();
    if (!tenantId) {
      return badRequest(res, "missing_tenant_id", "X-Tenant-Id header is required");
    }
    if (!isUuid(tenantId)) {
      return badRequest(res, "invalid_tenant_id", "X-Tenant-Id must be a UUID");
    }

    const userId = String(req.params.user_id || "").trim();
    if (!isUuid(userId)) {
      return badRequest(res, "invalid_user_id", "user_id must be a UUID");
    }

    const actorUserIdHeader = String(req.header("x-actor-user-id") || "").trim();
    const actorUserId = isUuid(actorUserIdHeader) ? actorUserIdHeader : null;

    if (action === "deactivate" && actorUserId && actorUserId === userId) {
      return res.status(409).json({
        ok: false,
        error: "cannot_deactivate_self",
        message: "Cannot deactivate yourself",
        rid: res.locals?.rid,
      });
    }

    const adminClient = getAdminClientOrError(res);
    if (adminClient.errorResponse) {
      return adminClient.errorResponse;
    }
    const sb = adminClient.sb;

    const tenantUsersColumns = await getTableColumns(sb, "tenant_users", ["tenant_id", "user_id"]);
    if (!tenantUsersColumns.has("tenant_id") || !tenantUsersColumns.has("user_id")) {
      return errorJson(
        res,
        500,
        "unsupported_schema",
        `tenant_users is missing required columns (tenant_users_columns=[${Array.from(tenantUsersColumns).sort().join(",")}])`
      );
    }

    const strategy = resolveMembershipStatusStrategy(tenantUsersColumns);
    if (strategy.kind === "none") {
      return errorJson(
        res,
        500,
        "unsupported_schema",
        "tenant_users must include one of is_active/active/deactivated_at/disabled_at/deleted_at for lifecycle actions"
      );
    }

    const membershipSelect = `tenant_id,user_id,${strategy.column}`;
    const { data: membershipRow, error: membershipError } = await sb
      .from("tenant_users")
      .select(membershipSelect)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      throw new Error(`tenant_membership_lookup_failed: ${membershipError.message}`);
    }

    if (!membershipRow) {
      return res.status(404).json({
        ok: false,
        error: "membership_not_found",
        message: "User is not a member of this tenant",
        rid: res.locals?.rid,
      });
    }

    const currentActive = isMembershipActive(membershipRow, strategy);
    const desiredActive = action === "reactivate";

    if (currentActive === desiredActive) {
      return res.status(200).json({
        ok: true,
        user_id: userId,
        tenant_id: tenantId,
        action,
        changed: false,
        already_in_state: true,
        rid: res.locals?.rid,
      });
    }

    if (action === "deactivate") {
      const activeAdminIds = await countActiveAdminIdsForTenant(sb, tenantId, strategy);
      if (activeAdminIds.has(userId) && activeAdminIds.size <= 1) {
        return res.status(409).json({
          ok: false,
          error: "last_admin_guard",
          message: "Cannot deactivate the last ADMIN for this tenant",
          rid: res.locals?.rid,
        });
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (strategy.kind === "boolean") {
      updatePayload[strategy.column] = desiredActive;
    } else {
      updatePayload[strategy.column] = desiredActive ? null : new Date().toISOString();
    }
    if (tenantUsersColumns.has("updated_at")) {
      updatePayload.updated_at = new Date().toISOString();
    }

    const { error: updateError } = await sb
      .from("tenant_users")
      .update(updatePayload)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(`tenant_membership_update_failed: ${updateError.message}`);
    }

    await writeAuditLog(sb, {
      tenantId,
      actorUserId,
      action: action === "deactivate" ? "user.deactivated" : "user.reactivated",
      entityType: "USER",
      entityId: userId,
      details: {
        rid: res.locals?.rid,
        strategy_kind: strategy.kind,
        strategy_column: strategy.column,
        previous_active: currentActive,
        current_active: desiredActive,
      },
    });

    return res.status(200).json({
      ok: true,
      user_id: userId,
      tenant_id: tenantId,
      action,
      changed: true,
      already_in_state: false,
      rid: res.locals?.rid,
    });
  } catch (err: any) {
    console.error("ADMIN_USER_LIFECYCLE_ERROR", {
      action,
      method: req.method,
      path: req.originalUrl,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return errorJson(res, 500, "admin_user_lifecycle_failed", err?.message ?? String(err));
  }
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

    const actorUserIdHeader = String(req.header("x-actor-user-id") || "").trim();
    const actorUserId = isUuid(actorUserIdHeader) ? actorUserIdHeader : null;

    const adminClient = getAdminClientOrError(res);
    if (adminClient.errorResponse) {
      return adminClient.errorResponse;
    }
    const sb = adminClient.sb;

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

    const tenantUsersColumns = await getTableColumns(sb, "tenant_users", ["tenant_id", "user_id"]);
    const tenantUserBase: Record<string, any> = { tenant_id: tenantId, user_id: userId };
    const tenantStatusStrategy = resolveMembershipStatusStrategy(tenantUsersColumns);
    if (tenantStatusStrategy.kind === "boolean") {
      tenantUserBase[tenantStatusStrategy.column] = true;
    } else if (tenantStatusStrategy.kind === "timestamp") {
      tenantUserBase[tenantStatusStrategy.column] = null;
    }

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

    const previousRoleKey = await fetchRoleKeyForUser(sb, userId);
    const { error: userRoleError } = await sb
      .from("user_roles")
      .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: "user_id" });
    if (userRoleError) {
      throw new Error(`user_roles_upsert_failed: ${userRoleError.message}`);
    }

    if (!previousRoleKey || previousRoleKey.toUpperCase() !== roleRow.key.toUpperCase()) {
      await writeAuditLog(sb, {
        tenantId,
        actorUserId,
        action: previousRoleKey ? "user.role_changed" : "user.role_assigned",
        entityType: "USER",
        entityId: userId,
        details: {
          rid: res.locals?.rid,
          previous_role_key: previousRoleKey,
          role_key_effective: roleRow.key,
          role_key_provided: roleKeyProvided,
        },
      });
    }

    await writeAuditLog(sb, {
      tenantId,
      actorUserId,
      action: invited ? "user.invited" : created ? "user.provisioned" : "user.invite_existing",
      entityType: "USER",
      entityId: userId,
      details: {
        rid: res.locals?.rid,
        email: emailNorm,
        invited,
        created,
        role_key_effective: roleRow.key,
        role_key_provided: roleKeyProvided,
      },
    });

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

adminUsersRouter.post("/users/:user_id/deactivate", async (req: Request, res: Response) => {
  return handleMembershipLifecycle(req, res, "deactivate");
});

adminUsersRouter.post("/users/:user_id/reactivate", async (req: Request, res: Response) => {
  return handleMembershipLifecycle(req, res, "reactivate");
});
