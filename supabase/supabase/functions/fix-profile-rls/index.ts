import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * This edge function fixes the infinite recursion in profiles RLS policies
 * by replacing self-referential policies with a SECURITY DEFINER function
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
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

    // Step 1: Disable RLS temporarily to fix policies
    console.log('Step 1: Disabling RLS on profiles table...');
    const { error: disableError } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;'
    }).catch(() => ({ error: null })); // RPC might not exist, try direct SQL

    // Step 2: Drop problematic policies
    console.log('Step 2: Dropping problematic policies...');
    const dropPolicies = `
      DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
      DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
      DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON profiles;
      DROP POLICY IF EXISTS "Admins can insert new profiles" ON profiles;
      DROP POLICY IF EXISTS "Admins can update profiles in their company" ON profiles;
      DROP POLICY IF EXISTS "Public can view profiles that created documents" ON profiles;
    `;

    // Step 3: Create SECURITY DEFINER function for admin checks
    console.log('Step 3: Creating SECURITY DEFINER function...');
    const createFunction = `
      CREATE OR REPLACE FUNCTION is_admin(user_id UUID, check_company_id UUID DEFAULT NULL)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = user_id 
          AND role = 'admin'
          AND (check_company_id IS NULL OR company_id = check_company_id)
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

      CREATE OR REPLACE FUNCTION is_active_user(user_id UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = user_id 
          AND status = 'active'
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    `;

    // Step 4: Re-enable RLS
    console.log('Step 4: Re-enabling RLS...');
    const enableRLS = 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;';

    // Step 5: Create safe policies using functions
    console.log('Step 5: Creating safe policies...');
    const createPolicies = `
      CREATE POLICY "Users can view their own profile" ON profiles
        FOR SELECT USING (auth.uid() = id);

      CREATE POLICY "Users can update their own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id);

      CREATE POLICY "Admins can view all profiles in their company" ON profiles
        FOR SELECT USING (is_admin(auth.uid(), company_id));

      CREATE POLICY "Admins can insert new profiles" ON profiles
        FOR INSERT WITH CHECK (is_admin(auth.uid()));

      CREATE POLICY "Admins can update profiles in their company" ON profiles
        FOR UPDATE USING (is_admin(auth.uid(), company_id));

      CREATE POLICY "Public can view profiles that created documents" ON profiles
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM quotations WHERE quotations.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM invoices WHERE invoices.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM proforma_invoices WHERE proforma_invoices.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM delivery_notes WHERE delivery_notes.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM payments WHERE payments.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM remittance_advice WHERE remittance_advice.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM stock_movements WHERE stock_movements.created_by = profiles.id
          )
        );
    `;

    // Execute all SQL
    const fullSQL = `${dropPolicies}\n${createFunction}\n${enableRLS}\n${createPolicies}`;

    const { error: executeError } = await supabase
      .rpc('exec_sql', { sql: fullSQL })
      .catch(async () => {
        // If RPC fails, try executeSQL utility if available
        console.log('RPC exec_sql not available, attempting alternative method...');
        return { error: new Error('RPC not available') };
      });

    if (executeError) {
      console.warn('Note: SQL execution via RPC may require additional setup');
      console.log('SQL to execute manually:');
      console.log(fullSQL);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'SQL generated successfully. Execute the SQL manually in Supabase.',
          sql: fullSQL
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profiles RLS policies fixed successfully'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
