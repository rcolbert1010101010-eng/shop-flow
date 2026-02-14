import type { NextFunction, Request, Response } from "express";

import { tenantMiddleware } from "./middleware/tenant";
import { authStubMiddleware } from "./middleware/authStub";
import { adminKeyGate } from "./middleware/adminKeyGate";
import { settingsRouter } from "./routes/settings";
import { customersRouter } from "./routes/customers";
import { unitsRouter } from "./routes/units";
import { vendorsRouter } from "./routes/vendors";
import { categoriesRouter } from "./routes/categories";
import { partsRouter } from "./routes/parts";
import { techniciansRouter } from "./routes/technicians";
import { adminUsersRouter } from "./routes/adminUsers";

const express = require("express") as typeof import("express");
const cors = require("cors") as typeof import("cors");
const { execSync } = require("child_process") as typeof import("child_process");
const path = require("path") as typeof import("path");
const fs = require("fs") as typeof import("fs");
const dotenv = require("dotenv") as typeof import("dotenv");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return false;
  dotenv.config({ path: filePath, override: false });
  return true;
}

function resolveEnvPath(repoRoot: string, candidate: string): string {
  if (path.isAbsolute(candidate)) return candidate;
  const fromRepoRoot = path.resolve(repoRoot, candidate);
  if (fs.existsSync(fromRepoRoot)) return fromRepoRoot;
  return path.resolve(process.cwd(), candidate);
}

function initializeEnv() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const selectedEnvFile = String(process.env.SHOPFLOW_ENV_FILE || "").trim();
  if (selectedEnvFile) {
    const selectedPath = resolveEnvPath(repoRoot, selectedEnvFile);
    if (!loadEnvFile(selectedPath)) {
      console.warn("ENV_FILE_NOT_FOUND", { selected: selectedEnvFile, resolved: selectedPath });
    }
  }

  // Fallback defaults only fill missing values (no override).
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(repoRoot, "server", ".env"));
  loadEnvFile(path.join(repoRoot, ".env"));
}

initializeEnv();

const app = express();
const API_PREFIX = "/api/v1";
const adminRouter = express.Router();

const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || "";
const serviceRoleKeyEnv = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "";
const adminApiKeyEnv = process.env.SHOPFLOW_ADMIN_API_KEY || process.env.X_SHOPFLOW_ADMIN_KEY || "";
const serviceRoleFingerprint = serviceRoleKeyEnv
  ? `${serviceRoleKeyEnv.slice(0, 10)}...${serviceRoleKeyEnv.slice(-6)}`
  : null;
const supabaseHost = (() => {
  if (!supabaseUrlEnv) return null;
  try {
    return new URL(supabaseUrlEnv).hostname || null;
  } catch {
    return null;
  }
})();
const gitBranch = (() => {
  const envBranch = String(process.env.GIT_BRANCH || "").trim();
  if (envBranch) {
    return envBranch;
  }
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
})();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  res.locals.rid = rid;
  res.setHeader("x-request-id", rid);

  let wroteBody = false;
  const responseAny = res as any;
  const originalWrite = responseAny.write.bind(res);
  const originalSend = responseAny.send.bind(res);
  const originalJson = responseAny.json.bind(res);
  const originalSendStatus = responseAny.sendStatus.bind(res);
  const originalEnd = responseAny.end.bind(res);

  responseAny.write = (chunk: any, ...args: any[]) => {
    if (chunk !== undefined && chunk !== null) {
      const size = typeof chunk === "string" ? chunk.length : Buffer.isBuffer(chunk) ? chunk.length : 1;
      if (size > 0) wroteBody = true;
    }
    return originalWrite(chunk, ...args);
  };

  responseAny.send = (body: any) => {
    if (body !== undefined && body !== null) {
      const size = typeof body === "string" ? body.length : Buffer.isBuffer(body) ? body.length : 1;
      if (size > 0) wroteBody = true;
    }
    return originalSend(body);
  };

  responseAny.json = (body: any) => {
    wroteBody = true;
    return originalJson(body);
  };

  responseAny.sendStatus = (code: number) => {
    if (code >= 400) {
      wroteBody = true;
      res.status(code).type("application/json");
      return originalSend(
        JSON.stringify({
          ok: false,
          error: `http_${code}`,
          message: `HTTP ${code}`,
          rid,
        })
      );
    }
    return originalSendStatus(code);
  };

  responseAny.end = (...args: any[]) => {
    const chunk = args[0];
    if (chunk !== undefined && chunk !== null) {
      const size = typeof chunk === "string" ? chunk.length : Buffer.isBuffer(chunk) ? chunk.length : 1;
      if (size > 0) wroteBody = true;
    }

    if (res.statusCode >= 400 && wroteBody === false && !res.headersSent) {
      const payload = JSON.stringify({
        ok: false,
        error: `http_${res.statusCode}`,
        message: `HTTP ${res.statusCode}`,
        rid,
      });
      console.warn("EMPTY_BODY_GUARDRAIL", {
        rid,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        tenantIdHeader: req.header("X-Tenant-Id") || req.header("x-tenant-id") || null,
      });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(payload).toString());
      wroteBody = true;
      return originalEnd(payload, args[1], args[2]);
    }

    return originalEnd(...args);
  };

  if (req.path.includes("/api/v1/admin/users/invite")) {
    res.on("finish", () => {
      console.log("ADMIN_INVITE_FINISH", {
        rid,
        statusCode: res.statusCode,
        contentLength: res.getHeader("content-length") ?? null,
      });
    });
  }

  return next();
});

adminRouter.use(adminKeyGate);
adminRouter.get("/ping", (_req: Request, res: Response) => {
  res.json({ ok: true });
});
adminRouter.use(tenantMiddleware);
adminRouter.use(adminUsersRouter);
app.use(`${API_PREFIX}/admin`, adminRouter);

app.use(authStubMiddleware);
app.use(tenantMiddleware);

// Mount settings router under the API prefix
app.use(API_PREFIX, settingsRouter);
app.use(API_PREFIX, customersRouter);
app.use(API_PREFIX, unitsRouter);
app.use(API_PREFIX, vendorsRouter);
app.use(API_PREFIX, categoriesRouter);
app.use(API_PREFIX, partsRouter);
app.use(API_PREFIX, techniciansRouter);

app.get(`${API_PREFIX}/health`, (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "repair-hub-pro-api",
    timestamp: new Date().toISOString(),
    supabase_host: supabaseHost,
    git_branch: gitBranch,
  });
});

app.use((_req: Request, res: Response) => {
  if (res.headersSent) return;
  return res.status(404).type("application/json").json({ ok: false, error: "not_found" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("UNHANDLED_ERROR", {
    rid: res.locals.rid,
    method: req.method,
    path: req.originalUrl,
    message: err?.message,
    name: err?.name,
    stack: err?.stack,
  });
  if (res.headersSent) return next(err);
  return res.status(500).type("application/json").json({
    ok: false,
    error: "internal_server_error",
    message: err?.message ?? "unknown",
    rid: res.locals.rid,
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log("SERVER_ENV", {
    supabase_url_present: Boolean(supabaseUrlEnv),
    supabase_service_role_key_present: Boolean(serviceRoleKeyEnv),
    shopflow_admin_api_key_present: Boolean(adminApiKeyEnv),
    supabase_service_role_key_fingerprint: serviceRoleFingerprint,
  });
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${PORT}${API_PREFIX}/health`);
});
