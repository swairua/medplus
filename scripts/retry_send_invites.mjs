/*
scripts/retry_send_invites.mjs

Usage:
DRY_RUN=1 BATCH=10 SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/retry_send_invites.mjs

This script finds pending invitations with no sent_at and calls the 'send-invite' Edge Function for each.
It uses the Supabase client (service role) to query invitations and to invoke the Edge Function.
*/
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = !!process.env.DRY_RUN;
const BATCH = parseInt(process.env.BATCH || '20', 10);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function getPendingInvitations(limit = BATCH) {
  const { data, error } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('status', 'pending')
    .is('sent_at', null)
    .lt('expires_at', new Date('9999-12-31').toISOString())
    .order('invited_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function invokeSendInvite(invitationId) {
  try {
    // Use functions.invoke provided by supabase-js
    if (typeof supabase.functions?.invoke === 'function') {
      const res = await supabase.functions.invoke('send-invite', { body: { invitation_id: invitationId } });
      return res;
    }

    // Fallback: call REST endpoint /functions/v1/send-invite
    const url = `${SUPABASE_URL}/functions/v1/send-invite`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ invitation_id: invitationId }),
    });

    const json = await resp.json();
    return { data: json, error: resp.ok ? null : { message: json } };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function main() {
  console.log('Starting retry-send-invites. DRY_RUN=', DRY_RUN, 'BATCH=', BATCH);
  const invites = await getPendingInvitations(BATCH);
  console.log(`Found ${invites.length} invitations to process`);

  for (const inv of invites) {
    console.log('Processing invitation', inv.id, inv.email);
    if (DRY_RUN) {
      console.log('[DRY RUN] Would invoke send-invite for', inv.id);
      continue;
    }

    const { data, error } = await invokeSendInvite(inv.id);
    if (error) {
      console.error('send-invite error for', inv.id, error);
      // record error in DB
      await supabase.from('user_invitations').update({ send_error: String(error) }).eq('id', inv.id);
      continue;
    }

    console.log('send-invite result for', inv.id, data);
    // Optionally refresh invitation row to get sent_at
    const { data: refreshed } = await supabase.from('user_invitations').select('id,sent_at,send_error').eq('id', inv.id).single();
    console.log('refreshed:', refreshed);
  }

  console.log('Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
