import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.2';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateUserRequest {
  email: string;
  password: string;
  full_name?: string;
  role: 'user' | 'admin' | 'accountant' | 'stock_manager';
  company_id: string;
  invited_by: string;
  phone?: string;
  department?: string;
  position?: string;
}

interface CreateUserResponse {
  success: boolean;
  user_id?: string;
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

    const rawBody = await req.json();
    const body: CreateUserRequest = rawBody;
    // Mask password in logs
    const safeBody = {
      ...rawBody,
      password: rawBody?.password ? '***' : null,
    };
    console.log('admin-create-user invoked', {
      method: req.method,
      url: (req as any).url || null,
      body: safeBody,
      auth_header_present: !!req.headers.get('authorization'),
    });

    // Validate required fields
    if (!body.email || !body.password || !body.role || !body.company_id || !body.invited_by) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: email, password, role, company_id, invited_by' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate password strength (minimum 8 characters, no additional requirements for admin creation)
    if (body.password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate role
    const validRoles = ['user', 'admin', 'accountant', 'stock_manager'];
    if (!validRoles.includes(body.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid role' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Supabase client with service role (for admin operations)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: missing environment variables' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify company exists
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', body.company_id)
      .maybeSingle();

    if (!company) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Create auth user with admin API
    let userId: string;
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true, // Auto-confirm email for admin-created users
        user_metadata: {
          full_name: body.full_name,
          role: body.role,
          company_id: body.company_id,
          department: body.department,
          position: body.position,
        },
      });

      if (authError) {
        console.error('Auth user creation error:', authError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to create auth user: ${authError.message}`,
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!authData.user?.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create auth user' }),
          { status: 500, headers: corsHeaders }
        );
      }

      userId = authData.user.id;
    } catch (err) {
      console.error('Error creating auth user:', err);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create auth user: ${err instanceof Error ? err.message : String(err)}`,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Create or update profile record with status 'active' (directly created users are immediately active)
    try {
      // Check for existing profile by email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', body.email)
        .maybeSingle();

      if (existingProfile) {
        // Update the placeholder profile (may have temporary id) to use the auth user id
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            id: userId,
            email: body.email,
            full_name: body.full_name || existingProfile.full_name || null,
            phone: body.phone || existingProfile.phone || null,
            department: body.department || existingProfile.department || null,
            position: body.position || existingProfile.position || null,
            company_id: body.company_id,
            role: body.role,
            status: 'active',
            is_active: true,
            password: body.password, // Will be hashed by DB trigger
            updated_at: new Date().toISOString(),
          })
          .eq('email', body.email);

        if (updateError) {
          console.error('Profile update error:', updateError);
          try {
            await supabase.auth.admin.deleteUser(userId);
          } catch (cleanupErr) {
            console.error('Failed to cleanup auth user after profile update error:', cleanupErr);
          }

          return new Response(
            JSON.stringify({ success: false, error: `Failed to update user profile: ${updateError.message}` }),
            { status: 400, headers: corsHeaders }
          );
        }
      } else {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: body.email,
            full_name: body.full_name || null,
            phone: body.phone || null,
            department: body.department || null,
            position: body.position || null,
            company_id: body.company_id,
            role: body.role,
            status: 'active', // Auto-activate admin-created users
            is_active: true,
            password: body.password, // Will be hashed by DB trigger
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          // Try to clean up auth user if profile creation fails
          console.error('Profile creation error:', profileError);
          try {
            await supabase.auth.admin.deleteUser(userId);
          } catch (cleanupErr) {
            console.error('Failed to cleanup auth user after profile creation error:', cleanupErr);
          }

          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to create user profile: ${profileError.message}`,
            }),
            { status: 400, headers: corsHeaders }
          );
        }
      }
    } catch (err) {
      // Try to clean up auth user if profile creation fails
      console.error('Error creating/updating profile:', err);
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (cleanupErr) {
        console.error('Failed to cleanup auth user after profile creation error:', cleanupErr);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create user profile: ${err instanceof Error ? err.message : String(err)}`,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Log user creation in audit trail
    try {
      await supabase.from('audit_logs').insert({
        action: 'CREATE',
        entity_type: 'user_creation',
        record_id: userId,
        company_id: body.company_id,
        actor_user_id: body.invited_by,
        actor_email: null, // Will be retrieved by hook if needed
        details: {
          created_user_email: body.email,
          created_user_role: body.role,
          created_user_full_name: body.full_name,
          timestamp: new Date().toISOString(),
          creation_method: 'admin_direct_creation',
        },
      });
    } catch (auditErr) {
      // Log to console but don't fail the operation
      console.warn('Failed to log user creation to audit trail:', auditErr);
    }

    console.log('admin-create-user success', { user_id: userId, email: body.email, company_id: body.company_id });
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
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
