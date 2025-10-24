import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseErrorMessageWithCodes } from '@/utils/errorHelpers';
import { RoleDefinition, Permission, DEFAULT_ROLE_PERMISSIONS } from '@/types/permissions';
import { logRoleChange } from '@/utils/auditLogger';

interface CreateRoleData {
  name: string;
  description?: string;
  permissions: Permission[];
  company_id?: string;
}

interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: Permission[];
}

export const useRoleManagement = () => {
  const { profile: currentUser, isAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all roles for the current company
   */
  const fetchRoles = useCallback(async () => {
    if (!isAdmin || !currentUser?.company_id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('roles')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setRoles(data || []);
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'fetching roles');
      console.error('Error fetching roles:', err);
      setError(errorMessage);
      toast.error(`Error fetching roles: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, currentUser?.company_id]);

  /**
   * Create a new custom role
   */
  const createRole = async (data: CreateRoleData): Promise<{ success: boolean; role?: RoleDefinition; error?: string }> => {
    if (!isAdmin || !currentUser?.company_id) {
      toast.error('You are not authorized or no company is selected');
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      const companyIdToUse = data.company_id || currentUser.company_id;
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({
          name: data.name,
          description: data.description,
          permissions: data.permissions,
          company_id: companyIdToUse,
          role_type: 'custom',
          is_default: false,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Log the role creation
      try {
        await logRoleChange('create', newRole.id, data.name, companyIdToUse, {
          permissions: data.permissions,
        });
      } catch (auditError) {
        console.error('Failed to log role creation:', auditError);
      }

      toast.success('Role created successfully');
      await fetchRoles();
      return { success: true, role: newRole };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'role creation');
      console.error('Error creating role:', err);
      toast.error(`Failed to create role: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update an existing role
   */
  const updateRole = async (
    roleId: string,
    data: UpdateRoleData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      toast.error('You are not authorized to update roles');
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      // Get the current role to check if it's default
      const currentRole = roles.find(r => r.id === roleId);
      if (currentRole?.is_default && !isAdmin) {
        return { success: false, error: 'Cannot modify default roles' };
      }

      const { error: updateError } = await supabase
        .from('roles')
        .update(data)
        .eq('id', roleId);

      if (updateError) {
        throw updateError;
      }

      // Log the role update with detailed permission changes
      try {
        const roleName = data.name || currentRole?.name || 'Unknown';
        const auditDetails: any = {
          changes: data,
        };

        // Track permission changes in detail
        if (data.permissions && currentRole?.permissions) {
          const oldPermissions = new Set(currentRole.permissions);
          const newPermissions = new Set(data.permissions);

          const addedPermissions = Array.from(newPermissions).filter(p => !oldPermissions.has(p));
          const removedPermissions = Array.from(oldPermissions).filter(p => !newPermissions.has(p));

          if (addedPermissions.length > 0 || removedPermissions.length > 0) {
            auditDetails.permission_changes = {
              added: addedPermissions,
              removed: removedPermissions,
              total_permissions: data.permissions.length,
            };
          }
        }

        await logRoleChange('update', roleId, roleName, currentUser?.company_id || '', auditDetails);
      } catch (auditError) {
        console.error('Failed to log role update:', auditError);
      }

      toast.success('Role updated successfully');
      await fetchRoles();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'role update');
      console.error('Error updating role:', err);
      toast.error(`Failed to update role: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a custom role
   */
  const deleteRole = async (roleId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      toast.error('You are not authorized to delete roles');
      return { success: false, error: 'Unauthorized' };
    }

    setLoading(true);

    try {
      const currentRole = roles.find(r => r.id === roleId);

      if (currentRole?.is_default) {
        return { success: false, error: 'Cannot delete default roles' };
      }

      // Check if any users have this role
      const { data: usersWithRole } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', currentRole?.name)
        .limit(1);

      if (usersWithRole && usersWithRole.length > 0) {
        return {
          success: false,
          error: 'Cannot delete role with assigned users. Please reassign users first.',
        };
      }

      const { error: deleteError } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) {
        throw deleteError;
      }

      // Log the role deletion
      try {
        await logRoleChange('delete', roleId, currentRole?.name || 'Unknown', currentUser?.company_id || '', {
          deleted_at: new Date().toISOString(),
        });
      } catch (auditError) {
        console.error('Failed to log role deletion:', auditError);
      }

      toast.success('Role deleted successfully');
      await fetchRoles();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'role deletion');
      console.error('Error deleting role:', err);
      toast.error(`Failed to delete role: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update permissions for a role
   */
  const updateRolePermissions = async (
    roleId: string,
    permissions: Permission[]
  ): Promise<{ success: boolean; error?: string }> => {
    return updateRole(roleId, { permissions });
  };

  /**
   * Get default permissions for a role type
   */
  const getDefaultPermissions = (roleType: string): Permission[] => {
    const key = roleType as keyof typeof DEFAULT_ROLE_PERMISSIONS;
    return DEFAULT_ROLE_PERMISSIONS[key] || [];
  };

  /**
   * Initialize default roles for a company (if not already done)
   */
  const initializeDefaultRoles = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin || !currentUser?.company_id) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // Check if default roles already exist
      const { data: existingRoles } = await supabase
        .from('roles')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('is_default', true)
        .limit(1);

      if (existingRoles && existingRoles.length > 0) {
        return { success: true }; // Already initialized
      }

      // Create default roles
      const defaultRoles = [
        {
          name: 'admin',
          description: 'Administrator with full system access',
          permissions: DEFAULT_ROLE_PERMISSIONS.admin,
          company_id: currentUser.company_id,
          role_type: 'admin',
          is_default: true,
        },
        {
          name: 'accountant',
          description: 'Accountant with financial access',
          permissions: DEFAULT_ROLE_PERMISSIONS.accountant,
          company_id: currentUser.company_id,
          role_type: 'accountant',
          is_default: true,
        },
        {
          name: 'stock_manager',
          description: 'Stock Manager with inventory management access',
          permissions: DEFAULT_ROLE_PERMISSIONS.stock_manager,
          company_id: currentUser.company_id,
          role_type: 'stock_manager',
          is_default: true,
        },
        {
          name: 'user',
          description: 'Basic user with limited access',
          permissions: DEFAULT_ROLE_PERMISSIONS.user,
          company_id: currentUser.company_id,
          role_type: 'user',
          is_default: true,
        },
      ];

      const { error: insertError } = await supabase
        .from('roles')
        .insert(defaultRoles);

      if (insertError) {
        throw insertError;
      }

      await fetchRoles();
      return { success: true };
    } catch (err) {
      const errorMessage = parseErrorMessageWithCodes(err, 'initializing default roles');
      console.error('Error initializing default roles:', err);
      return { success: false, error: errorMessage };
    }
  };

  // Fetch roles on mount
  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
      initializeDefaultRoles();
    }
  }, [isAdmin, currentUser?.company_id]);

  return {
    roles,
    loading,
    error,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    updateRolePermissions,
    getDefaultPermissions,
    initializeDefaultRoles,
  };
};

export default useRoleManagement;
