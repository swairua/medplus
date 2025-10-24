/**
 * Permission Types
 * Defines all granular permissions in the system
 */

export type Permission =
  // Quotation Permissions
  | 'create_quotation'
  | 'view_quotation'
  | 'edit_quotation'
  | 'delete_quotation'
  | 'export_quotation'

  // Invoice Permissions
  | 'create_invoice'
  | 'view_invoice'
  | 'edit_invoice'
  | 'delete_invoice'
  | 'export_invoice'

  // Credit Note Permissions
  | 'create_credit_note'
  | 'view_credit_note'
  | 'edit_credit_note'
  | 'delete_credit_note'
  | 'export_credit_note'

  // Proforma Permissions
  | 'create_proforma'
  | 'view_proforma'
  | 'edit_proforma'
  | 'delete_proforma'
  | 'export_proforma'

  // Payment Permissions
  | 'create_payment'
  | 'view_payment'
  | 'edit_payment'
  | 'delete_payment'

  // Inventory Permissions
  | 'create_inventory'
  | 'view_inventory'
  | 'edit_inventory'
  | 'delete_inventory'
  | 'manage_inventory'

  // Report Permissions
  | 'view_reports'
  | 'export_reports'
  | 'view_customer_reports'
  | 'view_inventory_reports'
  | 'view_sales_reports'

  // Customer Permissions
  | 'create_customer'
  | 'view_customer'
  | 'edit_customer'
  | 'delete_customer'

  // Delivery Note Permissions
  | 'create_delivery_note'
  | 'view_delivery_note'
  | 'edit_delivery_note'
  | 'delete_delivery_note'

  // LPO Permissions
  | 'create_lpo'
  | 'view_lpo'
  | 'edit_lpo'
  | 'delete_lpo'

  // Remittance Permissions
  | 'create_remittance'
  | 'view_remittance'
  | 'edit_remittance'
  | 'delete_remittance'

  // User Management Permissions
  | 'create_user'
  | 'edit_user'
  | 'delete_user'
  | 'manage_users'
  | 'approve_users'
  | 'invite_users'

  // Settings & Admin
  | 'view_audit_logs'
  | 'manage_roles'
  | 'manage_permissions'
  | 'access_settings';

export type RoleType = 'admin' | 'accountant' | 'stock_manager' | 'user' | 'custom';

export interface RoleDefinition {
  id: string;
  name: string;
  role_type: RoleType;
  description?: string;
  permissions: Permission[];
  company_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends RoleDefinition {
  permission_count: number;
}

/**
 * Default role permission mappings
 * These are preset permission sets for each default role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<RoleType, 'custom'>, Permission[]> = {
  admin: [
    // Admin has all permissions
    'create_quotation', 'view_quotation', 'edit_quotation', 'delete_quotation', 'export_quotation',
    'create_invoice', 'view_invoice', 'edit_invoice', 'delete_invoice', 'export_invoice',
    'create_credit_note', 'view_credit_note', 'edit_credit_note', 'delete_credit_note', 'export_credit_note',
    'create_proforma', 'view_proforma', 'edit_proforma', 'delete_proforma', 'export_proforma',
    'create_payment', 'view_payment', 'edit_payment', 'delete_payment',
    'create_inventory', 'view_inventory', 'edit_inventory', 'delete_inventory', 'manage_inventory',
    'view_reports', 'export_reports', 'view_customer_reports', 'view_inventory_reports', 'view_sales_reports',
    'create_customer', 'view_customer', 'edit_customer', 'delete_customer',
    'create_delivery_note', 'view_delivery_note', 'edit_delivery_note', 'delete_delivery_note',
    'create_lpo', 'view_lpo', 'edit_lpo', 'delete_lpo',
    'create_remittance', 'view_remittance', 'edit_remittance', 'delete_remittance',
    'create_user', 'edit_user', 'delete_user', 'manage_users', 'approve_users', 'invite_users',
    'view_audit_logs', 'manage_roles', 'manage_permissions', 'access_settings',
  ],
  accountant: [
    // Accountants can work with invoices, payments, and reports
    'create_quotation', 'view_quotation', 'edit_quotation', 'export_quotation',
    'create_invoice', 'view_invoice', 'edit_invoice', 'export_invoice',
    'create_credit_note', 'view_credit_note', 'edit_credit_note', 'export_credit_note',
    'create_proforma', 'view_proforma', 'edit_proforma', 'export_proforma',
    'create_payment', 'view_payment', 'edit_payment',
    'view_inventory', 'view_reports', 'export_reports', 'view_customer_reports', 'view_sales_reports',
    'view_customer', 'view_delivery_note',
    'view_lpo', 'view_remittance', 'create_remittance', 'view_audit_logs',
  ],
  stock_manager: [
    // Stock managers handle inventory and delivery notes
    'create_quotation', 'view_quotation', 'edit_quotation',
    'view_invoice', 'view_credit_note',
    'view_proforma', 'create_proforma',
    'create_inventory', 'view_inventory', 'edit_inventory', 'manage_inventory',
    'view_reports', 'view_inventory_reports',
    'view_customer', 'create_delivery_note', 'view_delivery_note', 'edit_delivery_note',
    'view_lpo', 'view_payment',
  ],
  user: [
    // Basic users have limited viewing permissions
    'create_quotation', 'view_quotation', 'edit_quotation',
    'view_invoice', 'view_credit_note', 'view_proforma',
    'view_inventory', 'view_reports', 'view_customer_reports', 'view_sales_reports',
    'view_customer', 'view_delivery_note',
    'view_lpo', 'view_payment',
  ],
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // Quotation
  'create_quotation': 'Create new quotations',
  'view_quotation': 'View quotations',
  'edit_quotation': 'Edit quotations',
  'delete_quotation': 'Delete quotations',
  'export_quotation': 'Export quotations',

  // Invoice
  'create_invoice': 'Create new invoices',
  'view_invoice': 'View invoices',
  'edit_invoice': 'Edit invoices',
  'delete_invoice': 'Delete invoices',
  'export_invoice': 'Export invoices',

  // Credit Note
  'create_credit_note': 'Create new credit notes',
  'view_credit_note': 'View credit notes',
  'edit_credit_note': 'Edit credit notes',
  'delete_credit_note': 'Delete credit notes',
  'export_credit_note': 'Export credit notes',

  // Proforma
  'create_proforma': 'Create new proforma invoices',
  'view_proforma': 'View proforma invoices',
  'edit_proforma': 'Edit proforma invoices',
  'delete_proforma': 'Delete proforma invoices',
  'export_proforma': 'Export proforma invoices',

  // Payment
  'create_payment': 'Create new payments',
  'view_payment': 'View payments',
  'edit_payment': 'Edit payments',
  'delete_payment': 'Delete payments',

  // Inventory
  'create_inventory': 'Create inventory items',
  'view_inventory': 'View inventory',
  'edit_inventory': 'Edit inventory items',
  'delete_inventory': 'Delete inventory items',
  'manage_inventory': 'Full inventory management',

  // Reports
  'view_reports': 'View reports',
  'export_reports': 'Export reports',
  'view_customer_reports': 'View customer reports',
  'view_inventory_reports': 'View inventory reports',
  'view_sales_reports': 'View sales reports',

  // Customer
  'create_customer': 'Create new customers',
  'view_customer': 'View customers',
  'edit_customer': 'Edit customers',
  'delete_customer': 'Delete customers',

  // Delivery Note
  'create_delivery_note': 'Create delivery notes',
  'view_delivery_note': 'View delivery notes',
  'edit_delivery_note': 'Edit delivery notes',
  'delete_delivery_note': 'Delete delivery notes',

  // LPO
  'create_lpo': 'Create local purchase orders',
  'view_lpo': 'View local purchase orders',
  'edit_lpo': 'Edit local purchase orders',
  'delete_lpo': 'Delete local purchase orders',

  // Remittance
  'create_remittance': 'Create remittance advice',
  'view_remittance': 'View remittance advice',
  'edit_remittance': 'Edit remittance advice',
  'delete_remittance': 'Delete remittance advice',

  // User Management
  'create_user': 'Create new users',
  'edit_user': 'Edit user profiles',
  'delete_user': 'Delete users',
  'manage_users': 'Full user management',
  'approve_users': 'Approve user invitations',
  'invite_users': 'Invite users',

  // Settings & Admin
  'view_audit_logs': 'View audit logs',
  'manage_roles': 'Manage roles and role assignments',
  'manage_permissions': 'Manage role permissions',
  'access_settings': 'Access system settings',
};
