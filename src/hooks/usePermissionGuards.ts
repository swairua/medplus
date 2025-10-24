import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/types/permissions';
import { toast } from 'sonner';

/**
 * Hook to guard operations with permission checks
 * Returns permission checking utilities
 */
export const usePermissionGuards = () => {
  const { isAdmin } = useAuth();
  const { can, canView, canDelete, canEdit, canCreate } = usePermissions();

  /**
   * Check if user has permission and show error toast if not
   */
  const checkPermission = (permission: Permission, actionName: string): boolean => {
    if (!can(permission)) {
      toast.error(`You don't have permission to ${actionName}`);
      return false;
    }
    return true;
  };

  /**
   * Check if user can delete an entity type
   */
  const checkCanDelete = (
    entityType: 'quotation' | 'invoice' | 'credit_note' | 'proforma' | 'customer' | 'inventory' | 'delivery_note' | 'lpo' | 'remittance' | 'payment',
    entityName?: string
  ): boolean => {
    if (!canDelete(entityType)) {
      toast.error(`You don't have permission to delete ${entityName || entityType.replace('_', ' ')}`);
      return false;
    }
    return true;
  };

  /**
   * Check if user can create an entity type
   */
  const checkCanCreate = (
    entityType: 'quotation' | 'invoice' | 'credit_note' | 'proforma' | 'customer' | 'inventory' | 'delivery_note' | 'lpo' | 'remittance' | 'payment',
    entityName?: string
  ): boolean => {
    if (!canCreate(entityType)) {
      toast.error(`You don't have permission to create ${entityName || entityType.replace('_', ' ')}`);
      return false;
    }
    return true;
  };

  /**
   * Check if user can edit an entity type
   */
  const checkCanEdit = (
    entityType: 'quotation' | 'invoice' | 'credit_note' | 'proforma' | 'customer' | 'inventory' | 'delivery_note' | 'lpo' | 'remittance' | 'payment',
    entityName?: string
  ): boolean => {
    if (!canEdit(entityType)) {
      toast.error(`You don't have permission to edit ${entityName || entityType.replace('_', ' ')}`);
      return false;
    }
    return true;
  };

  /**
   * Check if user can view an entity type
   */
  const checkCanView = (
    entityType: 'quotation' | 'invoice' | 'credit_note' | 'proforma' | 'customer' | 'inventory' | 'delivery_note' | 'lpo' | 'remittance' | 'payment' | 'reports',
    entityName?: string
  ): boolean => {
    if (!canView(entityType)) {
      toast.error(`You don't have permission to view ${entityName || entityType.replace('_', ' ')}`);
      return false;
    }
    return true;
  };

  return {
    isAdmin,
    checkPermission,
    checkCanDelete,
    checkCanCreate,
    checkCanEdit,
    checkCanView,
  };
};

export default usePermissionGuards;
