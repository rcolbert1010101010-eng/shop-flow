import { createClient } from "@supabase/supabase-js";
import { getAdminEnv } from "./_env.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getAdminEnv();

const requiredEnv = ["EMAIL", "NEW_PASS"];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(", ")}`
  );
  process.exit(1);
}

const { EMAIL, NEW_PASS } = process.env;

console.log(`supabase_url=${SUPABASE_URL}`);
console.log(`target_email=${EMAIL}`);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  try {
    const normalizedEmail = EMAIL.toLowerCase();
    const perPage = 200;
    let page = 1;
    let scannedUsers = 0;
    let pages = 0;
    let user = null;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) {
        throw error;
      }

      const users = data?.users || [];
      pages += 1;
      scannedUsers += users.length;

      user = users.find(
        (u) => (u?.email || "").toLowerCase() === normalizedEmail
      );
      if (user) {
        break;
      }

      if (users.length === 0) {
        break;
      }

      page += 1;
    }

    console.log(`scanned_users=${scannedUsers} pages=${pages}`);

    if (!user) {
      console.log(`User not found for email: ${EMAIL}`);
      console.log(`scanned_users=${scannedUsers} pages=${pages}`);
      process.exit(2);
    }

    const { error: updateError } =
      await admin.auth.admin.updateUserById(user.id, {
        password: NEW_PASS,
      });

    if (updateError) {
      throw updateError;
    }

    console.log("Password updated");
    console.log(`user_id=${user.id}`);
    console.log(`email=${user.email}`);
  } catch (err) {
    console.error(JSON.stringify(err, null, 2));
    process.exit(3);
  }
}

main();
