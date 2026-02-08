#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '';
const AUTH_EMAIL_DOMAIN = (process.env.AUTH_EMAIL_DOMAIN || process.env.VITE_AUTH_EMAIL_DOMAIN || '').trim();

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const usage = () => {
  return [
    'Usage:',
    '  node tools/admin/create-user.mjs --email user@example.com --tenant <uuid> [--password "..."] [--role TECHNICIAN]',
    '  node tools/admin/create-user.mjs --username tech1 --tenant <uuid> [--role TECHNICIAN]',
    '  node tools/admin/create-user.mjs --email user@example.com --send-invite --tenant <uuid> [--role TECHNICIAN]',
    '',
    'Env:',
    '  SUPABASE_URL',
    '  SUPABASE_SERVICE_ROLE_KEY',
    '  DEFAULT_TENANT_ID (optional)',
    '  AUTH_EMAIL_DOMAIN (optional, falls back to VITE_AUTH_EMAIL_DOMAIN)',
  ].join('\n');
};

const fail = (message) => {
  console.error(message);
  console.error(usage());
  process.exit(1);
};

if (!SUPABASE_URL) fail('Missing SUPABASE_URL');
if (!SERVICE_ROLE_KEY) fail('Missing SUPABASE_SERVICE_ROLE_KEY');

const emailArg = getArg('--email');
const usernameArg = getArg('--username');
const passwordArg = getArg('--password');
const tenantArg = getArg('--tenant');
const roleArg = getArg('--role');
const sendInvite = hasFlag('--send-invite');

if (!emailArg && !usernameArg) fail('Provide --email or --username');
if (emailArg && usernameArg) fail('Provide only one of --email or --username');

const normalizeUsername = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');

let email = '';
let usernameNormalized = '';

if (usernameArg) {
  usernameNormalized = normalizeUsername(usernameArg);
  if (!usernameNormalized) fail('Invalid --username after normalization');
  if (!AUTH_EMAIL_DOMAIN) {
    fail('AUTH_EMAIL_DOMAIN (or VITE_AUTH_EMAIL_DOMAIN) is required when using --username');
  }
  const domain = AUTH_EMAIL_DOMAIN.replace(/^@/, '').toLowerCase();
  email = `${usernameNormalized}@${domain}`;
} else if (emailArg) {
  const trimmed = emailArg.trim().toLowerCase();
  if (!trimmed.includes('@')) fail('Invalid --email');
  email = trimmed;
}

const tenantId = (tenantArg || DEFAULT_TENANT_ID || '').trim();
if (!tenantId) fail('Missing --tenant and DEFAULT_TENANT_ID is not set');

const roleKey = (roleArg || 'TECHNICIAN').toString().trim().toLowerCase();

const generateTempPassword = () => {
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const core = randomBytes(20).toString('base64url');
  const extra = [
    pick('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    pick('abcdefghijkmnopqrstuvwxyz'),
    pick('23456789'),
    pick('!@#$%*_-+?'),
  ].join('');
  return `${extra}${core}`;
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isMissingTableError = (error, tableName) => {
  const message = (error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    message.includes(`relation "${tableName}" does not exist`) ||
    message.includes(`relation \"public.${tableName}\" does not exist`) ||
    message.includes(`could not find the '${tableName}' table`) ||
    (message.includes('schema cache') && message.includes(tableName))
  );
};

const extractMissingColumn = (error) => {
  const message = (error?.message || '').toLowerCase();
  const matchA = message.match(/column "?([a-z0-9_]+)"? does not exist/);
  if (matchA?.[1]) return matchA[1];
  const matchB = message.match(/could not find the '([a-z0-9_]+)' column/);
  if (matchB?.[1]) return matchB[1];
  const matchC = message.match(/column ([a-z0-9_]+) of relation/);
  if (matchC?.[1]) return matchC[1];
  return null;
};

const isMissingColumnError = (error) => {
  const message = (error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    message.includes('column') && message.includes('does not exist') ||
    message.includes('schema cache') && message.includes('column')
  );
};

const upsertProfiles = async (payload) => {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.from('profiles').upsert(currentPayload, { onConflict: 'id' });
    if (!error) return;
    if (isMissingTableError(error, 'profiles')) {
      throw new Error('profiles table not found');
    }
    const missingColumn = extractMissingColumn(error);
    if (missingColumn && missingColumn in currentPayload) {
      delete currentPayload[missingColumn];
      continue;
    }
    if (isMissingColumnError(error)) {
      if ('active_tenant_id' in currentPayload) {
        delete currentPayload.active_tenant_id;
        continue;
      }
      if ('email' in currentPayload) {
        delete currentPayload.email;
        continue;
      }
    }
    throw new Error(`Failed to upsert profiles: ${error.message}`);
  }
};

const ensureTenantMembership = async (tenant_id, user_id) => {
  const { error } = await supabase
    .from('tenant_users')
    .upsert({ tenant_id, user_id }, { onConflict: 'tenant_id,user_id' });
  if (error) throw new Error(`Failed to ensure tenant membership: ${error.message}`);
};

const lookupRoleId = async (key) => {
  const { data, error } = await supabase
    .from('roles')
    .select('id')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`Failed to lookup role: ${error.message}`);
  if (!data?.id) throw new Error(`Role not found: ${key}`);
  return data.id;
};

const ensureSingleUserRole = async (user_id, role_id) => {
  const upsertResult = await supabase
    .from('user_roles')
    .upsert({ user_id, role_id }, { onConflict: 'user_id' });
  if (!upsertResult.error) return;

  const message = (upsertResult.error?.message || '').toLowerCase();
  const conflictIssue = message.includes('on conflict') || message.includes('unique') || message.includes('exclusion');
  if (!conflictIssue) {
    throw new Error(`Failed to upsert user_roles: ${upsertResult.error.message}`);
  }

  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', user_id);
  if (deleteError) throw new Error(`Failed to reset user_roles: ${deleteError.message}`);

  const { error: insertError } = await supabase.from('user_roles').insert({ user_id, role_id });
  if (insertError) throw new Error(`Failed to insert user_roles: ${insertError.message}`);
};

const ensureUserProfilesLink = async (user_id, profile_id, profileEmail) => {
  const linkPayload = { user_id, profile_id };
  const linkResult = await supabase
    .from('user_profiles')
    .upsert(linkPayload, { onConflict: 'user_id,profile_id' });
  if (!linkResult.error) return;
  if (isMissingTableError(linkResult.error, 'user_profiles')) return;

  const missingColumn = extractMissingColumn(linkResult.error);
  if (missingColumn || isMissingColumnError(linkResult.error)) {
    let payload = { id: user_id, email: profileEmail };
    const profileResult = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
    if (!profileResult.error) return;

    if (isMissingTableError(profileResult.error, 'user_profiles')) return;

    const missingProfileColumn = extractMissingColumn(profileResult.error);
    if (missingProfileColumn && missingProfileColumn in payload) {
      delete payload[missingProfileColumn];
      const retry = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
      if (!retry.error) return;
      if (isMissingTableError(retry.error, 'user_profiles')) return;
      throw new Error(`Failed to upsert user_profiles: ${retry.error.message}`);
    }

    if (isMissingColumnError(profileResult.error) && 'email' in payload) {
      delete payload.email;
      const retry = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
      if (!retry.error) return;
      if (isMissingTableError(retry.error, 'user_profiles')) return;
      throw new Error(`Failed to upsert user_profiles: ${retry.error.message}`);
    }

    throw new Error(`Failed to upsert user_profiles: ${profileResult.error.message}`);
  }

  throw new Error(`Failed to upsert user_profiles link: ${linkResult.error.message}`);
};

const run = async () => {
  let tempPassword;
  let createdUserId;

  if (sendInvite && passwordArg) {
    console.warn('Note: --password is ignored when using --send-invite');
  }

  if (sendInvite) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(`Invite failed: ${error.message}`);
    createdUserId = data?.user?.id || null;
  } else {
    const password = passwordArg || generateTempPassword();
    if (!passwordArg) tempPassword = password;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Create user failed: ${error.message}`);
    createdUserId = data?.user?.id || null;
  }

  if (!createdUserId) throw new Error('Missing user id from auth response');

  const profilePayload = { id: createdUserId, email };
  if (tenantId) profilePayload.active_tenant_id = tenantId;
  await upsertProfiles(profilePayload);
  await ensureTenantMembership(tenantId, createdUserId);

  const roleId = await lookupRoleId(roleKey);
  await ensureSingleUserRole(createdUserId, roleId);

  await ensureUserProfilesLink(createdUserId, createdUserId, email);

  console.log('Summary');
  console.log(`user_id: ${createdUserId}`);
  console.log(`email: ${email}`);
  console.log(`tenant_id: ${tenantId}`);
  console.log(`role_key: ${roleKey}`);
  if (tempPassword) console.log(`temp_password: ${tempPassword}`);
  console.log('next_steps:');
  console.log('- Provide credentials or have the user accept the invite.');
  console.log('- Confirm tenant access and role assignment in the admin UI.');
  console.log('- Ask the user to set a new password after first login.');
};

run().catch((err) => {
  console.error(err?.message || 'Unknown error');
  process.exit(1);
});
