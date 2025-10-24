-- =====================================================================
-- FIX: Infinite Recursion in Profiles RLS Policies
-- =====================================================================
-- 
-- PROBLEM:
-- The profiles table has RLS policies that query the profiles table 
-- within their EXISTS subqueries. This causes Postgres to recursively 
-- evaluate RLS policies, leading to infinite recursion.
--
-- SOLUTION:
-- Replace self-referential queries with a SECURITY DEFINER function
-- that bypasses RLS evaluation.
--
-- =====================================================================

-- Step 1: Drop existing problematic policies
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Admins can insert new profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Public can view profiles that created documents" ON profiles;


-- Step 2: Create SECURITY DEFINER functions for permission checks
-- =====================================================================
-- These functions run with elevated privileges and bypass RLS
-- making them safe to use within RLS policies

CREATE OR REPLACE FUNCTION is_admin(user_id UUID, check_company_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
BEGIN
  -- Directly query without RLS
  SELECT role, company_id INTO v_role, v_company_id
  FROM profiles
  WHERE id = user_id;
  
  IF v_role != 'admin' THEN
    RETURN FALSE;
  END IF;
  
  -- If company_id is specified, verify user is in same company
  IF check_company_id IS NOT NULL AND v_company_id != check_company_id THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin(UUID, UUID) TO authenticated;

-- Step 3: Create safe RLS policies using the function
-- =====================================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all profiles in their company
CREATE POLICY "Admins can view all profiles in their company" ON profiles
  FOR SELECT
  USING (is_admin(auth.uid(), company_id));

-- Admins can insert new profiles
CREATE POLICY "Admins can insert new profiles" ON profiles
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Admins can update profiles in their company
CREATE POLICY "Admins can update profiles in their company" ON profiles
  FOR UPDATE
  USING (is_admin(auth.uid(), company_id));

-- Public can view profiles that created documents
CREATE POLICY "Public can view profiles that created documents" ON profiles
  FOR SELECT
  USING (
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


-- =====================================================================
-- VERIFICATION (run these to check the fix worked)
-- =====================================================================

-- Check that policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check that function exists and is SECURITY DEFINER
SELECT proname, prosecdef, proowner::regrole
FROM pg_proc
WHERE proname = 'is_admin'
LIMIT 1;
