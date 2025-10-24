import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client with SERVICE_ROLE_KEY for admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

interface CreateUserRequest {
  email: string;
  full_name?: string;
  role: 'admin' | 'accountant' | 'stock_manager' | 'user';
  password?: string;
  phone?: string;
  department?: string;
  position?: string;
  company_id?: string;
}

// Validate that the requesting user is an admin
async function validateAdminRequest(token: string): Promise<boolean> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return profile?.role === 'admin';
  } catch {
    return false;
  }
}

// Generate temporary password
function generateTemporaryPassword(): string {
  const length = 12;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// POST /api/users/create - Create new user (admin only)
router.post('/create', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Validate admin privileges
    const isAdmin = await validateAdminRequest(token);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Only admins can create users' });
    }

    const userData: CreateUserRequest = req.body;

    // Validate required fields
    if (!userData.email || !userData.full_name) {
      return res.status(400).json({ success: false, error: 'Email and full name are required' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    // Create auth user with service role key
    const passwordToSet = userData.password && userData.password.length > 0 
      ? userData.password 
      : generateTemporaryPassword();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: passwordToSet,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name,
      },
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      return res.status(400).json({ success: false, error: authError.message });
    }

    // Update profile with additional data
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: userData.full_name,
        role: userData.role || 'user',
        phone: userData.phone,
        company_id: userData.company_id,
        department: userData.department,
        position: userData.position,
        status: 'active',
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return res.status(400).json({ success: false, error: profileError.message });
    }

    res.status(201).json({
      success: true,
      password: userData.password ? undefined : passwordToSet, // Only return if generated
      user: authData.user,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
