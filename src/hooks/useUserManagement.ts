import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, UserProfile, UserRole, UserStatus } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseErrorMessage, parseErrorMessageWithCodes } from '@/utils/errorHelpers';
import { logUserCreation, logUserApproval } from '@/utils/auditLogger';

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  company_id: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_at?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitation_token: string;
  is_approved?: boolean;
  approved_by?: string;
  approved_at?: string;
}

export interface CreateUserData {
  email: string;
  full_name?: string;
  role: UserRole;
  phone?: string;
  department?: string;
  position?: string;
  password?: string; // optional: admin can set password directly
  company_id?: string; // optional: super-admin can assign company when creating users
}

export interface UpdateUserData {
  full_name?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
  department?: string;
  position?: string;
}

export const useUserManagement = () => {
  const { profile: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all users in the same company
  const fetchUsers = async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // If admin belongs to a company, limit to that company. Super-admins without company can fetch all users.
      if (currentUser?.company_id) {
        query.eq('company_id', currentUser.company_id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setUsers(data || []);
    } catch (err) {
      const errorMessage = parseErrorMessage(err);
      console.error('Error fetching users:', err);
      setError(`Failed to fetch users: ${errorMessage}`);
      toast.error(`Error fetching users: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending invitations
  const fetchInvitations = async () => {
    if (!isAdmin) {
      return;
    }

    try {
      const query = supabase
        .from('user_invitations')
        .select('*')
        .order('invited_at', { ascending: false });

      if (currentUser?.company_id) {
        query.eq('company_id', currentUser.company_id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setInvitations(data || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);

      // Ensure we get a proper string error message
      let errorMessage = 'Unknown error occurred';
      try {
        errorMessage = parseErrorMessage(err);
        // Double-check that it's actually a string
        if (typeof errorMessage !== 'string') {
          errorMessage = String(errorMessage);
        }
      } catch (parseErr) {
        console.error('Error parsing error message:', parseErr);
        errorMessage = err?.message || err?.toString() || 'Failed to parse error';
      }

      setError(`Failed to fetch invitations: ${errorMessage}`);
      toast.error(`Error fetching invitations: ${errorMessage}`);
    }
  };

  // Create a new user (admin only) - Admin sets password; no self signup/email verify
  const createUser = async (userData: CreateUserData): Promise<{ success: boolean; password?: string; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized: Only administrators can create users' };
    }

    if (!userData.password || userData.password.length < 8) {
      return { success: false, error: 'Password is required (min 8 characters)' };
    }

    setLoading(true);

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .maybeSingle();

      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }

      const companyToSet = userData.company_id || currentUser?.company_id;

      // If no company is provided, try to get the first company
      let finalCompanyId = companyToSet;
      if (!finalCompanyId) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .single();
        finalCompanyId = companies?.id;
      }

      if (!finalCompanyId) {
        return { success: false, error: 'No company available. Please create a company first.' };
      }

      // Validate that admin can create users in this company (if not super-admin)
      if (currentUser?.company_id && currentUser.company_id !== finalCompanyId) {
        return { success: false, error: 'You can only create users for your own company' };
      }

      // Call Edge Function (admin-create-user) to create auth user + profile
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          phone: userData.phone,
          department: userData.department,
          position: userData.position,
          role: userData.role,
          company_id: finalCompanyId,
          invited_by: currentUser?.id,
        }
      });

      if (fnError) {
        throw fnError;
      }

      // Check if response indicates error
      if (fnData && !fnData.success) {
        return { success: false, error: fnData.error || 'Failed to create user' };
      }

      if (!fnData || !fnData.user_id) {
        return { success: false, error: 'Failed to create user - no user ID returned' };
      }

      toast.success('User created successfully');
      await fetchUsers();

      return {
        success: true,
        password: userData.password,
      };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'user creation');
      console.error('Error creating user:', err);
      toast.error(`Failed to create user: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Update user (admin only)
  const updateUser = async (userId: string, userData: UpdateUserData): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(userData)
        .eq('id', userId);

      if (error) {
        throw error;
      }

      toast.success('User updated successfully');
      await fetchUsers();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'user update');
      console.error('Error updating user:', err);
      toast.error(`Failed to update user: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Delete user (admin only)
  const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin || userId === currentUser?.id) {
      return { success: false, error: 'Cannot delete yourself or unauthorized' };
    }

    setLoading(true);

    try {
      // Delete from auth (this will cascade to profiles due to foreign key)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        throw authError;
      }

      toast.success('User deleted successfully');
      await fetchUsers();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'user deletion');
      console.error('Error deleting user:', err);
      toast.error(`Failed to delete user: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Invite user via email
  const inviteUser = async (email: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin || !currentUser?.company_id) {
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      // Check if user already exists or has pending invitation
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }

      const { data: existingInvitation } = await supabase
        .from('user_invitations')
        .select('id')
        .eq('email', email)
        .eq('company_id', currentUser.company_id)
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        return { success: false, error: 'Invitation already sent to this email' };
      }

      // Create invitation
      const { data: invitation, error } = await supabase
        .from('user_invitations')
        .insert({
          email,
          role,
          company_id: currentUser.company_id,
          invited_by: currentUser.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log user invitation in audit trail
      try {
        if (invitation) {
          await logUserCreation(invitation.id, email, role, currentUser.company_id);
        }
      } catch (auditError) {
        console.error('Failed to log user invitation to audit trail:', auditError);
        // Don't fail the operation if audit logging fails
      }

      // TODO: Send invitation email (would integrate with your email service)

      toast.success('User invitation sent successfully');
      await fetchInvitations();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'invitation');
      console.error('Error sending invitation:', err);
      toast.error(`Failed to send invitation: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Revoke invitation
  const revokeInvitation = async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) {
        throw error;
      }

      toast.success('Invitation revoked successfully');
      await fetchInvitations();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'invitation revocation');
      console.error('Error revoking invitation:', err);
      toast.error(`Failed to revoke invitation: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Accept invitation (for invited users)
  const acceptInvitation = async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: invitation, error: fetchError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('invitation_token', token)
        .eq('status', 'pending')
        .single();

      if (fetchError || !invitation) {
        return { success: false, error: 'Invalid or expired invitation' };
      }

      // Check if invitation has been approved by admin
      if (!invitation.is_approved) {
        return { success: false, error: 'This invitation is pending admin approval. Please wait for your administrator to approve your account.' };
      }

      // Check if invitation has expired
      if (new Date(invitation.expires_at) < new Date()) {
        await supabase
          .from('user_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);

        return { success: false, error: 'Invitation has expired' };
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('user_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (updateError) {
        throw updateError;
      }

      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'invitation acceptance');
      console.error('Error accepting invitation:', err);
      return { success: false, error: errorMessage };
    }
  };

  // Promote all existing users to admin (dangerous - admin only)
  const promoteAllToAdmin = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .or('role.is.null,role.neq.admin');

      if (error) {
        throw error;
      }

      const updatedCount = Array.isArray(data) ? data.length : 0;
      toast.success(`Promoted ${updatedCount} users to admin`);
      await fetchUsers();
      return { success: true, count: updatedCount };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'promote all');
      console.error('Error promoting users:', err);
      toast.error(`Failed to promote users: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Approve invitation (admin only)
  const approveInvitation = async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      // Get invitation details first for audit logging
      const { data: invitationData } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      const { error } = await supabase
        .from('user_invitations')
        .update({
          is_approved: true,
          approved_by: currentUser?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', invitationId);

      if (error) {
        throw error;
      }

      // If a profile already exists for this email (user already signed up), activate it and assign role/company
      try {
        if (invitationData?.email) {
          const { data: profileExists } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', invitationData.email)
            .maybeSingle();

          if (profileExists?.id) {
            await supabase
              .from('profiles')
              .update({
                status: 'active',
                role: invitationData.role,
                company_id: invitationData.company_id
              })
              .eq('id', profileExists.id);
          }
        }
      } catch (profileActivateErr) {
        console.warn('Could not auto-activate existing profile on approval:', profileActivateErr);
      }

      // Log approval in audit trail
      try {
        if (invitationData) {
          await logUserApproval(invitationId, invitationData.email, invitationData.company_id, 'approved');
        }
      } catch (auditError) {
        console.error('Failed to log approval to audit trail:', auditError);
      }

      toast.success('Invitation approved successfully');
      await fetchInvitations();
      await fetchUsers();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'invitation approval');
      console.error('Error approving invitation:', err);
      toast.error(`Failed to approve invitation: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Get user statistics
  const getUserStats = () => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const pendingUsers = users.filter(u => u.status === 'pending').length;
    const inactiveUsers = users.filter(u => u.status === 'inactive').length;

    const adminUsers = users.filter(u => u.role === 'admin').length;
    const accountantUsers = users.filter(u => u.role === 'accountant').length;
    const stockManagerUsers = users.filter(u => u.role === 'stock_manager').length;
    const basicUsers = users.filter(u => u.role === 'user').length;

    const pendingInvitations = invitations.filter(i => i.status === 'pending').length;

    return {
      totalUsers,
      activeUsers,
      pendingUsers,
      inactiveUsers,
      adminUsers,
      accountantUsers,
      stockManagerUsers,
      basicUsers,
      pendingInvitations,
    };
  };

  // Reset user password (admin only) - sends password reset email
  const resetUserPassword = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      const user = users.find(u => u.id === userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Call Edge Function to send password reset email
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          email: user.email,
          user_id: userId,
          admin_id: currentUser?.id,
        }
      });

      if (fnError) {
        throw fnError;
      }

      if (fnData && !fnData.success) {
        return { success: false, error: fnData.error || 'Failed to send password reset email' };
      }

      toast.success(`Password reset email sent to ${user.email}`);
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'password reset');
      console.error('Error resetting password:', err);
      toast.error(`Failed to reset password: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchInvitations();
    }
  }, [isAdmin]);

  return {
    users,
    invitations,
    loading,
    error,
    fetchUsers,
    fetchInvitations,
    createUser,
    updateUser,
    deleteUser,
    inviteUser,
    revokeInvitation,
    approveInvitation,
    acceptInvitation,
    resetUserPassword,
    getUserStats,
    promoteAllToAdmin,
  };
};

// Helper function to generate temporary password
const generateTemporaryPassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default useUserManagement;
