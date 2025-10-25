import { corsHeaders } from '../_shared/cors.ts';

// This Edge Function sends an invitation email for a given invitation_id using SendGrid.
// Requirements (set these in the Supabase Edge Function environment):
// - SENDGRID_API_KEY
// - FROM_EMAIL
// - FRONTEND_URL (e.g., https://app.example.com)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    const invitationId = body?.invitation_id;
    if (!invitationId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing invitation_id' }), { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL');
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://app.medplus.example';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured (supabase env missing)' }), { status: 500, headers: corsHeaders });
    }

    if (!SENDGRID_API_KEY || !FROM_EMAIL) {
      console.warn('SendGrid not configured; skipping email send');
    }

    // Create a Supabase client using Deno (lightweight)
    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = SUPABASE_SERVICE_KEY;
    // Minimal fetch to Supabase REST to get invitation details
    const inviteRes = await fetch(`${supabaseUrl}/rest/v1/user_invitations?id=eq.${invitationId}&select=*`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!inviteRes.ok) {
      const txt = await inviteRes.text();
      console.error('Failed to fetch invitation:', txt);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch invitation' }), { status: 500, headers: corsHeaders });
    }

    const invites = await inviteRes.json();
    const invitation = Array.isArray(invites) ? invites[0] : invites;
    if (!invitation) {
      return new Response(JSON.stringify({ success: false, error: 'Invitation not found' }), { status: 404, headers: corsHeaders });
    }

    // Build accept link
    const token = invitation.invitation_token;
    const acceptUrl = `${FRONTEND_URL}/accept-invite?token=${token}`;

    // Compose email
    const to = invitation.email;
    const subject = 'You are invited to join Medplus Africa';
    const html = `
      <p>Hello,</p>
      <p>You have been invited to join <strong>Medplus Africa</strong>. Click the link below to accept the invitation and set up your account:</p>
      <p><a href="${acceptUrl}">${acceptUrl}</a></p>
      <p>This invitation expires on <strong>${invitation.expires_at}</strong>.</p>
      <p>If you did not expect this invitation, ignore this message.</p>
    `;

    if (SENDGRID_API_KEY && FROM_EMAIL) {
      const sgResp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: FROM_EMAIL },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!sgResp.ok) {
        const txt = await sgResp.text();
        console.error('SendGrid send failed:', sgResp.status, txt);
        // don't fail completely; mark invitation with send_error
        await fetch(`${supabaseUrl}/rest/v1/user_invitations?id=eq.${invitationId}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ send_error: txt }),
        });

        return new Response(JSON.stringify({ success: false, error: 'Failed to send email' }), { status: 500, headers: corsHeaders });
      }

      // Mark invitation as sent
      await fetch(`${supabaseUrl}/rest/v1/user_invitations?id=eq.${invitationId}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ sent_at: new Date().toISOString(), send_error: null }),
      });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    // If SendGrid not configured, just mark sent_at for visibility
    await fetch(`${supabaseUrl}/rest/v1/user_invitations?id=eq.${invitationId}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ sent_at: new Date().toISOString(), send_error: 'sendgrid_not_configured' }),
    });

    return new Response(JSON.stringify({ success: true, notice: 'sendgrid_not_configured' }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('send-invite unexpected error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
