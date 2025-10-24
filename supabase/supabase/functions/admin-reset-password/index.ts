import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.2';
import { corsHeaders } from '../_shared/cors.ts';

interface ResetPasswordRequest {
  email: string;
  user_id: string;
  admin_id: string;
}

interface ResetPasswordResponse {
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    const body: ResetPasswordRequest = await req.json();

    // Validate required fields
    if (!body.email || !body.user_id || !body.admin_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email, user_id, admin_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify admin user exists and is admin
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', body.admin_id)
      .maybeSingle();

    if (!adminUser || adminUser.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Only admins can reset passwords' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Verify target user exists
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', body.user_id)
      .maybeSingle();

    if (!targetUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Send password reset email using Supabase auth
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
        redirectTo: `${supabaseUrl.replace(/\/$/, '')}/auth/v1/callback`,
      });

      if (error) {
        console.error('Password reset email error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to send password reset email: ${error.message}`,
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    } catch (err) {
      console.error('Error sending password reset email:', err);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to send password reset email: ${err instanceof Error ? err.message : String(err)}`,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Log password reset request in audit trail
    try {
      await supabase.from('audit_logs').insert({
        action: 'APPROVE',
        entity_type: 'user_creation',
        record_id: body.user_id,
        actor_user_id: body.admin_id,
        actor_email: adminUser?.email,
        details: {
          action_type: 'password_reset',
          target_user_email: body.email,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn('Failed to log password reset to audit trail:', auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
