/**
 * Approve admin@medplus.app account for login
 * Usage: node scripts/approve-admin-account.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://klifzjcfnlaxminytmyh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Please set: export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function approveAdminAccount() {
  try {
    console.log('🔄 Checking admin@medplus.app account...');

    // Check if profile exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, status, role')
      .eq('email', 'admin@medplus.app')
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error fetching profile:', fetchError.message);
      process.exit(1);
    }

    if (!profile) {
      console.error('❌ admin@medplus.app profile not found');
      process.exit(1);
    }

    console.log(`\n📋 Current Account Status:`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Status: ${profile.status || 'not set'}`);
    console.log(`   Role: ${profile.role || 'not set'}`);

    // Update status to active
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError.message);
      process.exit(1);
    }

    console.log(`\n✅ Account approved! admin@medplus.app can now login`);
    console.log(`   Updated status to: active`);

    // Check for pending invitations and approve them too
    const { data: invitations, error: inviteError } = await supabase
      .from('user_invitations')
      .select('id, status, is_approved')
      .eq('email', 'admin@medplus.app')
      .eq('status', 'pending');

    if (!inviteError && invitations && invitations.length > 0) {
      console.log(`\n📧 Found ${invitations.length} pending invitation(s)`);
      
      for (const invitation of invitations) {
        const { error: approveError } = await supabase
          .from('user_invitations')
          .update({ 
            is_approved: true,
            approved_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        if (approveError) {
          console.warn(`⚠️  Could not approve invitation ${invitation.id}:`, approveError.message);
        } else {
          console.log(`✅ Approved invitation ${invitation.id.substring(0, 8)}...`);
        }
      }
    }

    console.log(`\n🎉 Setup complete! User can now sign in with:`);
    console.log(`   Email: admin@medplus.app`);
    console.log(`   Password: (as previously set)`);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

approveAdminAccount();
