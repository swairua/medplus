import { createClient } from '@supabase/supabase-js';

// Usage:
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env
// DRY_RUN=1 to only report changes without applying
// node scripts/reconcile_auth_users.mjs

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = !!process.env.DRY_RUN;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function listAllUsers() {
  const perPage = 100;
  let page = 1;
  let allUsers = [];

  while (true) {
    // supabase-js admin list API may return different shapes; handle common possibilities
    try {
      const res = await supabase.auth.admin.listUsers({ page, per_page: perPage });
      if (res.error) {
        console.error('List users error:', res.error);
        throw res.error;
      }

      // res.data may be { users: [...] } or an array depending on version
      const users = (res.data && res.data.users) ? res.data.users : res.data;
      if (!users || users.length === 0) break;
      allUsers = allUsers.concat(users);

      if (users.length < perPage) break; // last page
      page += 1;
    } catch (err) {
      console.error('Failed to list users:', err);
      throw err;
    }
  }

  return allUsers;
}

async function reconcile() {
  console.log('Starting reconciliation. DRY_RUN=', DRY_RUN);
  const users = await listAllUsers();
  console.log(`Fetched ${users.length} auth users`);

  let matched = 0;
  let updated = 0;
  let skippedNoProfile = 0;
  let skippedAlreadyLinked = 0;

  for (const u of users) {
    // normalize email
    const email = (u.email || '').trim();
    if (!email) continue;

    // find profile by case-insensitive email
    const { data: profile, error: selErr } = await supabase
      .from('profiles')
      .select('id, auth_user_id, email')
      .ilike('email', email)
      .maybeSingle();

    if (selErr) {
      console.error('Failed to query profiles for', email, selErr);
      continue;
    }

    if (!profile) {
      skippedNoProfile += 1;
      continue;
    }

    matched += 1;

    if (profile.auth_user_id) {
      skippedAlreadyLinked += 1;
      continue;
    }

    console.log(`Will link profile ${profile.id} (email=${profile.email}) -> auth_user_id=${u.id}`);

    if (!DRY_RUN) {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ auth_user_id: u.id, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updErr) {
        console.error('Failed to update profile', profile.id, updErr);
        continue;
      }

      updated += 1;
    }
  }

  console.log('Reconciliation complete. Summary:');
  console.log('  total auth.users scanned:', users.length);
  console.log('  profiles matched by email:', matched);
  console.log('  profiles updated (auth_user_id set):', updated);
  console.log('  profiles already linked:', skippedAlreadyLinked);
  console.log('  auth users with no matching profile:', skippedNoProfile);
}

reconcile().catch((err) => {
  console.error('Reconcile failed', err);
  process.exit(1);
});
