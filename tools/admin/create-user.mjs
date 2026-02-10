#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getAdminEnv();

const requiredEnv = ["EMAIL", "NEW_PASS"];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(", ")}. ` +
      "Set them and retry."
  );
  process.exit(1);
}

const { EMAIL, NEW_PASS } = process.env;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const targetEmail = EMAIL.toLowerCase();
const perPage = 200;
let page = 1;
let scannedUsers = 0;

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({
    page,
    perPage,
  });

  if (error) {
    console.error(JSON.stringify(error, null, 2));
    process.exit(2);
  }

  const users = data?.users ?? [];
  scannedUsers += users.length;
  console.log(`scanned_users=${scannedUsers} page=${page}`);

  const match = users.find(
    (user) => (user.email ?? "").toLowerCase() === targetEmail
  );

  if (match) {
    console.log("User already exists");
    console.log(`user_id=${match.id}`);
    console.log(`email=${match.email}`);
    process.exit(0);
  }

  if (users.length === 0) {
    break;
  }

  page += 1;
}

const { data: created, error: createError } =
  await admin.auth.admin.createUser({
    email: EMAIL,
    password: NEW_PASS,
    email_confirm: true,
  });

if (createError) {
  console.error(JSON.stringify(createError, null, 2));
  process.exit(2);
}

console.log("User created");
console.log(`user_id=${created?.user?.id}`);
console.log(`email=${created?.user?.email}`);
