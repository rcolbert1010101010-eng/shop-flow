// BREAK-GLASS: uses service role key. Do not run casually.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local in repo root');
  process.exit(1);
}

const parseEnv = (content) => {
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cleaned = line.startsWith('export ') ? line.slice(7).trim() : line;
    const idx = cleaned.indexOf('=');
    if (idx === -1) continue;
    const key = cleaned.slice(0, idx).trim();
    let value = cleaned.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL in .env.local');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const usernameArg = getArg('--username');
const password = getArg('--password');
const roleArg = getArg('--role');
const fullName = getArg('--full-name');
const callerId = getArg('--caller-id') || '110195f1-983e-42fc-9335-82589afd3b4b';

if (!usernameArg) {
  console.error('Missing required --username');
  process.exit(1);
}
if (!password) {
  console.error('Missing required --password');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters');
  process.exit(1);
}
if (!roleArg) {
  console.error('Missing required --role');
  process.exit(1);
}

const username = usernameArg.toLowerCase();
const role = roleArg.toUpperCase();
const allowedRoles = new Set([
  'ADMIN',
  'MANAGER',
  'SERVICE_WRITER',
  'TECHNICIAN',
  'PARTS_MANAGER',
  'SALES_COUNTER',
  'GUEST',
]);

if (!allowedRoles.has(role)) {
  console.error(`Invalid --role. Allowed: ${Array.from(allowedRoles).join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = async () => {
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('active_tenant_id')
    .eq('id', callerId)
    .maybeSingle();

  if (profileError) {
    console.error(`Failed to load caller profile: ${profileError.message}`);
    process.exit(1);
  }

  let tenantId = profileRow?.active_tenant_id ?? null;

  if (!tenantId) {
    const { data: membershipRow, error: membershipError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', callerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(`Failed to load caller tenant memberships: ${membershipError.message}`);
      process.exit(1);
    }

    tenantId = membershipRow?.tenant_id ?? null;
  }

  if (!tenantId) {
    console.error('Caller has no active tenant or memberships');
    process.exit(1);
  }

  const email = `${username}@local.shopflow`;

  const { data: existingUser, error: existingUserError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUserError && existingUserError.code !== 'PGRST116') {
    console.error(`Failed to check existing user: ${existingUserError.message}`);
    process.exit(1);
  }

  if (existingUser?.id) {
    console.error('username_exists');
    process.exit(1);
  }

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName ?? null },
  });

  if (createError || !createdUser?.user?.id) {
    console.error(createError?.message ?? 'Failed to create user');
    process.exit(1);
  }

  const userId = createdUser.user.id;

  const { error: tenantUserError } = await supabase
    .from('tenant_users')
    .upsert({ tenant_id: tenantId, user_id: userId, role: role.toLowerCase() }, { onConflict: 'tenant_id,user_id' });

  if (tenantUserError) {
    console.error(`Failed to upsert tenant_users: ${tenantUserError.message}`);
    process.exit(1);
  }

  const { error: userProfileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName ?? null,
        is_active: true,
      },
      { onConflict: 'id' },
    );

  if (userProfileError) {
    console.error(`Failed to upsert user_profiles: ${userProfileError.message}`);
    process.exit(1);
  }

  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('key', role.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();

  if (roleError || !roleRow?.id) {
    console.error(roleError?.message ?? 'Role not found or inactive');
    process.exit(1);
  }

  const { error: userRoleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: 'user_id' });

  if (userRoleError) {
    console.error(`Failed to upsert user_roles: ${userRoleError.message}`);
    process.exit(1);
  }

  const output = {
    success: true,
    user_id: userId,
    email,
    tenant_id: tenantId,
  };

  process.stdout.write(`${JSON.stringify(output)}\n`);
};

run().catch((err) => {
  console.error(err?.message ?? 'Unknown error');
  process.exit(1);
});
