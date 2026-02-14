import { Router, type Request, type Response } from "express";

const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
const { randomBytes } = require("crypto") as typeof import("crypto");

type InviteBody = {
  email?: string;
  role_key?: string;
  full_name?: string;
};

type CreateUserBody = {
  email?: string;
  password?: string;
  role_key?: string;
  full_name?: string;
};

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

function isForeignKeyConstraintError(error: any): boolean {
  const message = normalizeErrorMessage(error);
  const code = String((error as any)?.code || "").toUpperCase();
  return code === "23503" || message.includes("foreign key") || message.includes("violates");
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

function createUserError(
  res: Response,
  status: number,
  error: string,
  details?: unknown,
  context?: Record<string, unknown>
) {
  const payload: Record<string, unknown> = { error };
  if (details !== undefined) {
    payload.details = details;
  }
  if (context !== undefined) {
    payload.context = context;
  }
  return res.status(status).type("application/json").json(payload);
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
  const insertPayload: Record<string, unknown> = {
    tenant_id: payload.tenantId,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
  };

  if (payload.actorUserId && isUuid(payload.actorUserId)) {
    insertPayload.actor_user_id = payload.actorUserId;
  }
  if (payload.details) {
    insertPayload.details = payload.details;
  }
  insertPayload.created_at = new Date().toISOString();

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

function isTenantMembershipAdminRole(role: unknown): boolean {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "admin";
}

function resolveActorUserId(req: Request, res: Response): string | null {
  const actorUserIdHeader = String(req.header("x-actor-user-id") || "").trim();
  if (isUuid(actorUserIdHeader)) {
    return actorUserIdHeader;
  }

  const localUserId = String(res.locals?.userId || "").trim();
  if (isUuid(localUserId)) {
    return localUserId;
  }

  return null;
}

async function listTenantAdminUserIds(
  sb: ReturnType<typeof createClient>,
  tenantId: string
): Promise<Set<string>> {
  const { data: membershipRows, error: membershipError } = await sb
    .from("tenant_users")
    .select("user_id,role")
    .eq("tenant_id", tenantId);

  if (membershipError) {
    throw new Error(`tenant_membership_query_failed: ${membershipError.message}`);
  }

  const adminIds = new Set<string>();
  for (const row of membershipRows ?? []) {
    const userId = String((row as any)?.user_id || "").trim();
    const role = (row as any)?.role;
    if (!isUuid(userId)) continue;
    if (isTenantMembershipAdminRole(role)) {
      adminIds.add(userId);
    }
  }

  return adminIds;
}

adminUsersRouter.get("/users", async (req: Request, res: Response) => {
  try {
    const tenantId = String(res.locals?.tenantId || "").trim();
    if (!tenantId) {
      return createUserError(res, 400, "missing_tenant_id", { header: "X-Tenant-Id" }, { step: "tenant" });
    }
    if (!isUuid(tenantId)) {
      return createUserError(res, 400, "invalid_tenant_id", "X-Tenant-Id must be a UUID", { step: "tenant" });
    }

    const adminClient = getAdminClientOrError(res);
    if (adminClient.errorResponse) {
      return adminClient.errorResponse;
    }
    const sb = adminClient.sb;
    const actorUserId = resolveActorUserId(req, res);

    const { data: membershipRowsRaw, error: membershipRowsError } = await sb
      .from("tenant_users")
      .select("tenant_id,user_id,role,created_at,updated_at")
      .eq("tenant_id", tenantId);
    if (membershipRowsError) {
      return createUserError(res, 500, "users_list_failed", membershipRowsError.message, { step: "users_list" });
    }

    const membershipRows = (membershipRowsRaw ?? []) as any[];
    const tenantAdminUserIds = await listTenantAdminUserIds(sb, tenantId);
    const userIds = Array.from(
      new Set(
        membershipRows
          .map((row) => String(row?.user_id || "").trim())
          .filter((value) => isUuid(value))
      )
    );

    const directoryByUserId = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: directoryRows, error: directoryError } = await sb
        .from("tenant_user_directory_v")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds);
      if (directoryError) {
        return createUserError(res, 500, "users_list_failed", directoryError.message, { step: "users_list" });
      }
      for (const row of directoryRows ?? []) {
        const userId = String((row as any)?.user_id || "").trim();
        if (userId) {
          directoryByUserId.set(userId, row);
        }
      }
    }

    const payload = membershipRows.map((membershipRow: any) => {
      const userId = String(membershipRow?.user_id || "").trim();
      const directoryRow = directoryByUserId.get(userId) || null;
      const { is_active: _ignoreDirectoryIsActive, ...directoryWithoutIsActive } = (directoryRow ?? {}) as Record<
        string,
        unknown
      >;
      const hasUserId = isUuid(userId);
      const hasCurrentTenantMembership = String(membershipRow?.tenant_id || "").trim() === tenantId;
      const isSelf = Boolean(actorUserId && hasUserId && actorUserId === userId);
      const isAdminMembership = isTenantMembershipAdminRole(membershipRow?.role);
      const adminCountAfterRemove = tenantAdminUserIds.size - (isAdminMembership ? 1 : 0);
      const wouldLeaveNoAdmin = adminCountAfterRemove <= 0;
      const canRemoveFromTenant = hasCurrentTenantMembership && hasUserId && !isSelf && !wouldLeaveNoAdmin;
      let removeDisabledReason: string | null = null;
      if (!canRemoveFromTenant) {
        if (!hasUserId) {
          removeDisabledReason = "No removable id is available for this row.";
        } else if (isSelf) {
          removeDisabledReason = "Cannot remove your own membership from this tenant.";
        } else if (wouldLeaveNoAdmin) {
          removeDisabledReason = "Cannot remove the last ADMIN from this tenant.";
        } else if (!hasCurrentTenantMembership) {
          removeDisabledReason = "User is not a member of this tenant.";
        } else {
          removeDisabledReason = "Remove is blocked by membership safety checks.";
        }
      }

      return {
        ...directoryWithoutIsActive,
        tenant_id: tenantId,
        id: hasUserId ? userId : null,
        user_id: hasUserId ? userId : null,
        role: membershipRow?.role ?? null,
        membership_role: membershipRow?.role ?? directoryRow?.membership_role ?? null,
        created_at: membershipRow?.created_at ?? directoryRow?.created_at ?? null,
        updated_at: membershipRow?.updated_at ?? null,
        is_owner: false,
        can_remove_from_tenant: canRemoveFromTenant,
        remove_disabled_reason: removeDisabledReason,
      };
    });

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("ADMIN_USERS_LIST_ERROR", {
      rid: res.locals?.rid,
      method: req.method,
      path: req.originalUrl,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return createUserError(res, 500, "admin_users_list_failed", err?.message ?? String(err), { step: "unhandled" });
  }
});

adminUsersRouter.post("/tenants/:tenantId/bootstrap-membership", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.params.tenantId || "").trim();
    if (!isUuid(tenantId)) {
      return createUserError(res, 400, "invalid_tenant_id", "tenantId must be a UUID", { step: "tenant" });
    }

    const adminClient = getAdminClientOrError(res);
    if (adminClient.errorResponse) {
      return adminClient.errorResponse;
    }
    const sb = adminClient.sb;

    const { data: tenantRow, error: tenantLookupError } = await sb
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .limit(1)
      .maybeSingle();

    if (tenantLookupError) {
      return createUserError(res, 500, "tenant_lookup_failed", tenantLookupError.message, { step: "tenant_lookup" });
    }
    if (!tenantRow) {
      return res.status(404).type("application/json").json({ error: "tenant_not_found" });
    }

    const { data: authUsers, error: authUsersError } = await sb
      .schema("auth")
      .from("users")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (authUsersError) {
      return createUserError(res, 500, "auth_users_lookup_failed", authUsersError.message, {
        step: "auth_users_lookup",
      });
    }

    const bootUserId = String((authUsers ?? [])[0]?.id || "").trim();
    if (!isUuid(bootUserId)) {
      return res.status(400).type("application/json").json({ error: "no_auth_users_found" });
    }

    const now = new Date().toISOString();
    const membershipPayload = {
      tenant_id: tenantId,
      user_id: bootUserId,
      role: "ADMIN",
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    let membershipError: any = null;
    const membershipUpsert = await sb
      .from("tenant_users")
      .upsert(membershipPayload, { onConflict: "tenant_id,user_id" });
    membershipError = membershipUpsert.error ?? null;

    if (membershipError && shouldFallbackToInsert(membershipError)) {
      const membershipInsert = await sb.from("tenant_users").insert(membershipPayload);
      if (!membershipInsert.error || isDuplicateError(membershipInsert.error)) {
        membershipError = null;
      } else {
        membershipError = membershipInsert.error;
      }
    } else if (membershipError && isDuplicateError(membershipError)) {
      membershipError = null;
    }

    if (membershipError) {
      return createUserError(res, 500, "tenant_membership_bootstrap_failed", membershipError.message, {
        step: "tenant_membership_bootstrap",
      });
    }

    return res.status(200).json({
      tenant_id: tenantId,
      user_id: bootUserId,
      role: "ADMIN",
      is_active: true,
      bootstrapped: true,
    });
  } catch (err: any) {
    console.error("ADMIN_TENANT_BOOTSTRAP_MEMBERSHIP_ERROR", {
      method: req.method,
      path: req.originalUrl,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return createUserError(res, 500, "admin_tenant_bootstrap_membership_failed", err?.message ?? String(err), {
      step: "unhandled",
    });
  }
});

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

    const tenantUserPayload: Record<string, any> = {
      tenant_id: tenantId,
      user_id: userId,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let tenantUsersError: any = null;
    const upsertResult = await sb
      .from("tenant_users")
      .upsert(tenantUserPayload, { onConflict: "tenant_id,user_id" });
    tenantUsersError = upsertResult.error ?? null;

    if (tenantUsersError && shouldFallbackToInsert(tenantUsersError)) {
      const insertResult = await sb.from("tenant_users").insert(tenantUserPayload);
      if (!insertResult.error || isDuplicateError(insertResult.error)) {
        tenantUsersError = null;
      } else {
        tenantUsersError = insertResult.error;
      }
    }

    if (tenantUsersError) {
      throw new Error(`tenant_users_upsert_failed: ${tenantUsersError.message}`);
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

adminUsersRouter.post("/users", async (req: Request, res: Response) => {
  const tenantId = String(res.locals?.tenantId || "").trim();
  if (!tenantId) {
    return createUserError(res, 400, "missing_tenant_id", { header: "X-Tenant-Id" }, { step: "tenant" });
  }

  const body = (req.body ?? {}) as CreateUserBody;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const roleKeyRaw = String(body.role_key ?? "").trim();
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

  const details: Record<string, string> = {};
  if (!email) {
    details.email = "required";
  } else if (!email.includes("@")) {
    details.email = "invalid";
  }
  if (!password) {
    details.password = "required";
  }
  if (!roleKeyRaw) {
    details.role_key = "required";
  }

  if (Object.keys(details).length > 0) {
    return createUserError(res, 400, "validation_error", details, { step: "validation" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return createUserError(res, 500, "missing_env", { missing }, { step: "env" });
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: createdData, error: createError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !createdData?.user?.id) {
      if (createError) {
        console.error("ADMIN_USER_CREATE_AUTH_ERROR", {
          rid: res.locals?.rid,
          message: createError.message,
          status: (createError as any)?.status,
          email,
          tenant_id: tenantId,
        });
      } else {
        console.error("ADMIN_USER_CREATE_AUTH_ERROR", {
          rid: res.locals?.rid,
          message: "auth_admin_create_missing_user_id",
          email,
          tenant_id: tenantId,
        });
      }
      const message = createError?.message ?? "auth_admin_create_failed";
      const normalized = normalizeErrorMessage(createError ?? message);
      if (isAlreadyRegisteredMessage(normalized)) {
        return createUserError(res, 409, "user_already_exists", message, { step: "auth_create" });
      }
      if (isInvalidEmailMessage(normalized)) {
        return createUserError(res, 400, "invalid_email", message, { step: "auth_create" });
      }
      if (isInvalidApiKeyMessage(normalized)) {
        return createUserError(res, 502, "upstream_auth_failed", message, { step: "auth_create" });
      }
      return createUserError(res, 500, "auth_admin_api_failed", message, { step: "auth_create" });
    }

    const userId = createdData.user.id;

    const tenantUserBase: Record<string, any> = {
      tenant_id: tenantId,
      user_id: userId,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const lookupExistingMembership = async () => {
      const lookup = await sb
        .from("tenant_users")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      if (lookup.error) {
        console.error("ADMIN_USER_CREATE_TENANT_LOOKUP_ERROR", {
          rid: res.locals?.rid,
          tenant_id: tenantId,
          user_id: userId,
          message: lookup.error.message,
        });
        return {
          membershipRow: null,
          errorResponse: createUserError(
            res,
            500,
            "tenant_membership_lookup_failed",
            lookup.error.message,
            { step: "tenant_membership_lookup" }
          ),
        };
      }
      return { membershipRow: lookup.data ?? null, errorResponse: null };
    };

    let membershipRow: any = null;
    let membershipError: any = null;

    const attemptMembershipUpsert = await sb
      .from("tenant_users")
      .upsert(tenantUserBase, { onConflict: "tenant_id,user_id" })
      .select()
      .maybeSingle();

    if (!attemptMembershipUpsert.error) {
      membershipRow = attemptMembershipUpsert.data ?? null;
    } else if (isDuplicateError(attemptMembershipUpsert.error)) {
      console.warn("ADMIN_USER_CREATE_TENANT_UPSERT_DUPLICATE", {
        rid: res.locals?.rid,
        tenant_id: tenantId,
        user_id: userId,
        message: attemptMembershipUpsert.error.message,
      });
      const lookup = await lookupExistingMembership();
      if (lookup.errorResponse) return lookup.errorResponse;
      membershipRow = lookup.membershipRow;
    } else if (shouldFallbackToInsert(attemptMembershipUpsert.error)) {
      const attemptMembershipInsert = await sb.from("tenant_users").insert(tenantUserBase).select().maybeSingle();
      if (!attemptMembershipInsert.error) {
        membershipRow = attemptMembershipInsert.data ?? null;
      } else if (isDuplicateError(attemptMembershipInsert.error)) {
        console.warn("ADMIN_USER_CREATE_TENANT_INSERT_DUPLICATE", {
          rid: res.locals?.rid,
          tenant_id: tenantId,
          user_id: userId,
          message: attemptMembershipInsert.error.message,
        });
        const lookup = await lookupExistingMembership();
        if (lookup.errorResponse) return lookup.errorResponse;
        membershipRow = lookup.membershipRow;
      } else {
        membershipError = attemptMembershipInsert.error;
      }
    } else {
      membershipError = attemptMembershipUpsert.error;
    }

    if (membershipError) {
      console.error("ADMIN_USER_CREATE_TENANT_UPSERT_ERROR", {
        rid: res.locals?.rid,
        tenant_id: tenantId,
        user_id: userId,
        message: membershipError.message,
      });
      return createUserError(
        res,
        500,
        "tenant_membership_upsert_failed",
        membershipError.message,
        { step: "tenant_membership_upsert" }
      );
    }

    const { data: roleRowExact, error: roleErrExact } = await sb
      .from("roles")
      .select("id,key")
      .eq("key", roleKeyRaw)
      .maybeSingle();
    if (roleErrExact) {
      return createUserError(res, 500, "roles_lookup_failed", roleErrExact.message, { step: "role_resolution" });
    }

    let roleRow = roleRowExact as { id: string; key: string } | null;
    if (!roleRow) {
      const { data: roleRowCI, error: roleErrCI } = await sb
        .from("roles")
        .select("id,key")
        .ilike("key", roleKeyRaw)
        .maybeSingle();
      if (roleErrCI) {
        return createUserError(res, 500, "roles_lookup_failed", roleErrCI.message, { step: "role_resolution" });
      }
      roleRow = (roleRowCI as { id: string; key: string } | null) ?? null;
    }

    if (!roleRow) {
      const { data: validRolesData, error: validRolesError } = await sb.from("roles").select("key").order("key", {
        ascending: true,
      });
      if (validRolesError) {
        return createUserError(res, 500, "roles_lookup_failed", validRolesError.message, {
          step: "role_resolution",
        });
      }
      const validRoleKeys = (validRolesData ?? [])
        .map((r: any) => String(r?.key || "").trim())
        .filter(Boolean);
      return createUserError(
        res,
        400,
        "invalid_role_key",
        {
          provided: roleKeyRaw,
          valid_role_keys: validRoleKeys,
        },
        { step: "role_resolution" }
      );
    }

    const { error: userRoleError } = await sb
      .from("user_roles")
      .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: "user_id" });
    if (userRoleError) {
      return createUserError(res, 500, "user_roles_upsert_failed", userRoleError.message, { step: "role_assignment" });
    }

    return res.status(200).json({
      user_id: userId,
      email,
      tenant_id: tenantId,
      role_key: roleRow.key,
    });
  } catch (err: any) {
    console.error("ADMIN_USER_CREATE_ERROR", {
      method: req.method,
      path: req.originalUrl,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return createUserError(res, 500, "admin_user_create_failed", err?.message ?? String(err), {
      step: "unhandled",
    });
  }
});

adminUsersRouter.delete("/tenant-users/:userId", async (req: Request, res: Response) => {
  const rid = res.locals?.rid;
  const tenantId = String(res.locals?.tenantId || "").trim();
  if (!tenantId) {
    return createUserError(res, 400, "missing_tenant_id", { header: "X-Tenant-Id" }, { step: "tenant" });
  }
  if (!isUuid(tenantId)) {
    return createUserError(res, 400, "invalid_tenant_id", "X-Tenant-Id must be a UUID", { step: "tenant" });
  }

  const userId = String(req.params.userId || "").trim();
  if (!isUuid(userId)) {
    return createUserError(res, 400, "invalid_user_id", "user_id must be a UUID", { step: "validation" });
  }

  const actorUserId = resolveActorUserId(req, res);
  // TODO(auth): derive actor UUID from validated auth token/session rather than optional headers.

  const adminClient = getAdminClientOrError(res);
  if (adminClient.errorResponse) {
    return adminClient.errorResponse;
  }
  const sb = adminClient.sb;

  try {
    const { data: membershipRow, error: membershipLookupError } = await sb
      .from("tenant_users")
      .select("tenant_id,user_id,role")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipLookupError) {
      return createUserError(res, 500, "tenant_membership_lookup_failed", membershipLookupError.message, {
        step: "tenant_membership_lookup",
      });
    }
    if (!membershipRow) {
      return res.status(404).type("application/json").json({
        error: "membership_not_found",
        message: "User is not a member of this tenant.",
        context: { step: "tenant_membership_lookup" },
      });
    }

    if (actorUserId && actorUserId === userId) {
      return res.status(409).type("application/json").json({
        error: "cannot_remove_self",
        message: "Cannot remove your own membership from this tenant.",
        context: { step: "safety_guard" },
      });
    }

    const targetIsAdminMembership = isTenantMembershipAdminRole((membershipRow as any)?.role);
    const { count: adminCount, error: adminCountError } = await sb
      .from("tenant_users")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .ilike("role", "admin");
    if (adminCountError) {
      return createUserError(res, 500, "tenant_admin_count_failed", adminCountError.message, {
        step: "safety_guard",
      });
    }
    if (targetIsAdminMembership && (adminCount ?? 0) <= 1) {
      return res.status(409).type("application/json").json({
        error: "cannot_remove_last_admin",
        details: "Tenant must have at least one admin.",
      });
    }

    const { error: membershipDeleteError } = await sb
      .from("tenant_users")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);
    if (membershipDeleteError) {
      if (isForeignKeyConstraintError(membershipDeleteError)) {
        return res.status(409).type("application/json").json({
          error: "cannot_remove_membership",
          message: "Cannot remove: user has tenant membership or related records.",
          context: { step: "tenant_membership_delete" },
        });
      }
      return createUserError(res, 500, "tenant_membership_delete_failed", membershipDeleteError.message, {
        step: "tenant_membership_delete",
      });
    }

    console.info("ADMIN_TENANT_USER_REMOVE_SUCCESS", {
      rid,
      tenant_id: tenantId,
      user_id: userId,
    });

    return res.status(200).json({
      success: true,
      removed: true,
    });
  } catch (err: any) {
    console.error("ADMIN_TENANT_USER_REMOVE_ERROR", {
      rid,
      method: req.method,
      path: req.originalUrl,
      tenant_id: tenantId,
      user_id: userId,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return createUserError(res, 500, "admin_tenant_user_remove_failed", err?.message ?? String(err), {
      step: "unhandled",
    });
  }
});

adminUsersRouter.delete("/users/:userId", async (req: Request, res: Response) => {
  const rid = res.locals?.rid;
  const tenantId = String(res.locals?.tenantId || "").trim();
  if (!tenantId) {
    return res.status(400).type("application/json").json({
      deleted: false,
      reason: "missing_tenant_id",
      details: { header: "X-Tenant-Id" },
    });
  }
  if (!isUuid(tenantId)) {
    return res.status(400).type("application/json").json({
      deleted: false,
      reason: "invalid_tenant_id",
      details: "X-Tenant-Id must be a UUID",
    });
  }

  const userId = String(req.params.userId || "").trim();
  if (!isUuid(userId)) {
    return res.status(400).type("application/json").json({
      deleted: false,
      reason: "invalid_user_id",
      details: "user_id must be a UUID",
    });
  }

  const actorUserId = resolveActorUserId(req, res);

  const adminClient = getAdminClientOrError(res);
  if (adminClient.errorResponse) {
    return adminClient.errorResponse;
  }
  const sb = adminClient.sb;

  try {
    console.info("ADMIN_USER_DELETE_REQUEST", {
      rid,
      tenant_id: tenantId,
      user_id: userId,
    });

    if (actorUserId && actorUserId === userId) {
      return res.status(409).type("application/json").json({
        deleted: false,
        reason: "cannot_delete_self",
      });
    }

    const tenantAdminUserIds = await listTenantAdminUserIds(sb, tenantId);
    const adminCountAfterDelete = tenantAdminUserIds.size - (tenantAdminUserIds.has(userId) ? 1 : 0);
    if (adminCountAfterDelete <= 0) {
      return res.status(409).type("application/json").json({
        deleted: false,
        reason: "last_active_admin_guard",
      });
    }

    const { data: authLookupData, error: authLookupError } = await sb.auth.admin.getUserById(userId);
    if (authLookupError || !authLookupData?.user?.id) {
      const message = authLookupError?.message ?? "User not found";
      const normalized = normalizeErrorMessage(authLookupError ?? message);
      if (
        normalized.includes("user not found") ||
        normalized.includes("not found") ||
        normalized.includes("unable to find user")
      ) {
        return res.status(404).type("application/json").json({
          deleted: false,
          reason: "user_not_found",
          details: { step: "auth_user_lookup" },
        });
      }
      if (isInvalidApiKeyMessage(normalized)) {
        return res.status(502).type("application/json").json({
          deleted: false,
          reason: "upstream_auth_failed",
          details: { message, step: "auth_user_lookup" },
        });
      }
      return res.status(500).type("application/json").json({
        deleted: false,
        reason: "auth_user_lookup_failed",
        details: { message, step: "auth_user_lookup" },
      });
    }

    const { data: memberships, error: membershipsError } = await sb
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1);
    if (membershipsError) {
      return res.status(500).type("application/json").json({
        deleted: false,
        reason: "tenant_membership_lookup_failed",
        details: { message: membershipsError.message, step: "unused_account_check" },
      });
    }

    if ((memberships ?? []).length > 0) {
      return res.status(409).type("application/json").json({
        deleted: false,
        reason: "cannot_delete_used_account",
        details: "Cannot delete: user has tenant membership or related records.",
      });
    }

    const { error: membershipDeleteError } = await sb.from("tenant_users").delete().eq("user_id", userId);
    if (membershipDeleteError) {
      if (isForeignKeyConstraintError(membershipDeleteError)) {
        return res.status(409).type("application/json").json({
          deleted: false,
          reason: "cannot_delete_used_account",
          details: "Cannot delete: user has tenant membership or related records.",
        });
      }
      return res.status(500).type("application/json").json({
        deleted: false,
        reason: "tenant_membership_delete_failed",
        details: { message: membershipDeleteError.message, step: "tenant_membership_delete" },
      });
    }

    const { error: userRolesDeleteError } = await sb.from("user_roles").delete().eq("user_id", userId);
    if (userRolesDeleteError) {
      if (isForeignKeyConstraintError(userRolesDeleteError)) {
        return res.status(409).type("application/json").json({
          deleted: false,
          reason: "cannot_delete_used_account",
          details: "Cannot delete: user has tenant membership or related records.",
        });
      }
      return res.status(500).type("application/json").json({
        deleted: false,
        reason: "user_roles_delete_failed",
        details: { message: userRolesDeleteError.message, step: "user_roles_delete" },
      });
    }

    const { error: userProfilesDeleteError } = await sb.from("user_profiles").delete().eq("id", userId);
    if (userProfilesDeleteError) {
      if (isForeignKeyConstraintError(userProfilesDeleteError)) {
        return res.status(409).type("application/json").json({
          deleted: false,
          reason: "cannot_delete_used_account",
          details: "Cannot delete: user has tenant membership or related records.",
        });
      }
      return res.status(500).type("application/json").json({
        deleted: false,
        reason: "user_profiles_delete_failed",
        details: { message: userProfilesDeleteError.message, step: "user_profiles_delete" },
      });
    }

    const { error: authDeleteError } = await sb.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      const message = authDeleteError.message ?? "auth_user_delete_failed";
      const normalized = normalizeErrorMessage(authDeleteError ?? message);
      if (normalized.includes("user not found") || normalized.includes("not found")) {
        return res.status(404).type("application/json").json({
          deleted: false,
          reason: "user_not_found",
          details: { step: "auth_user_delete" },
        });
      }
      if (isForeignKeyConstraintError(authDeleteError)) {
        return res.status(409).type("application/json").json({
          deleted: false,
          reason: "cannot_delete_used_account",
          details: "Cannot delete: user has tenant membership or related records.",
        });
      }
      if (isInvalidApiKeyMessage(normalized)) {
        return res.status(502).type("application/json").json({
          deleted: false,
          reason: "upstream_auth_failed",
          details: { message, step: "auth_user_delete" },
        });
      }
      return res.status(500).type("application/json").json({
        deleted: false,
        reason: "auth_user_delete_failed",
        details: { message, step: "auth_user_delete" },
      });
    }

    console.info("ADMIN_USER_DELETE_SUCCESS", {
      rid,
      tenant_id: tenantId,
      user_id: userId,
    });

    return res.status(200).json({
      deleted: true,
    });
  } catch (err: any) {
    console.error("ADMIN_USER_DELETE_ERROR", {
      rid,
      method: req.method,
      path: req.originalUrl,
      tenant_id: tenantId,
      user_id: userId,
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return res.status(500).type("application/json").json({
      deleted: false,
      reason: "admin_user_delete_failed",
      details: { message: err?.message ?? String(err), step: "unhandled" },
    });
  }
});
