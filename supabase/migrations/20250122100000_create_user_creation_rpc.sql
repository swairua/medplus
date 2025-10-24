-- Create RPC function for creating users (with admin verification)
-- This function is called from the frontend and handles user creation securely

CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_password TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_password TEXT;
  v_temp_password TEXT;
  v_company_to_set UUID;
  v_admin_company_id UUID;
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can create users');
  END IF;

  -- Get admin's company
  SELECT company_id INTO v_admin_company_id
  FROM profiles WHERE id = auth.uid();

  -- Set company to admin's company or provided company (if admin is super-admin with no company)
  v_company_to_set := COALESCE(p_company_id, v_admin_company_id);

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists');
  END IF;

  -- Generate temporary password if not provided
  v_temp_password := COALESCE(p_password, 'Temp' || substr(md5(random()::text), 1, 8) || '!Aa1');

  -- Note: We cannot create auth.users directly from RPC with anon key
  -- Instead, we'll insert directly into profiles table and rely on the handle_new_user trigger
  -- OR return instructions for the frontend to handle auth creation
  
  -- For now, return success with password so frontend can create auth user
  -- Then call this function to update the profile
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Please use signUp to create auth user first',
    'password', v_temp_password,
    'company_id', v_company_to_set
  );
END;
$$;

-- Create RPC function to update profile after auth user is created
CREATE OR REPLACE FUNCTION public.update_profile_after_signup(
  p_user_id UUID,
  p_full_name TEXT,
  p_role TEXT,
  p_phone TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_company_id UUID;
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can update user profiles');
  END IF;

  -- Get admin's company
  SELECT company_id INTO v_admin_company_id
  FROM profiles WHERE id = auth.uid();

  -- Update the profile
  UPDATE profiles
  SET 
    full_name = p_full_name,
    role = CASE 
      WHEN p_role::text IN ('admin', 'accountant', 'stock_manager', 'user') 
      THEN p_role::user_role 
      ELSE 'user'::user_role 
    END,
    phone = COALESCE(p_phone, phone),
    department = COALESCE(p_department, department),
    position = COALESCE(p_position, position),
    company_id = COALESCE(p_company_id, v_admin_company_id, company_id),
    status = 'active'::user_status,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Profile updated successfully');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_user_with_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_after_signup(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
