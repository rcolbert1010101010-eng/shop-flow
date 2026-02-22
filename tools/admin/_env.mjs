import fs from "fs";
import path from "path";
import process from "process";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const envPath = path.join(repoRoot, ".env.admin");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TENANT_ID"];

export function getAdminEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required env vars: ${missing.join(", ")}. ` +
        "Copy .env.admin.example to .env.admin and fill in values."
    );
    process.exit(1);
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TENANT_ID: process.env.TENANT_ID,
  };
}
