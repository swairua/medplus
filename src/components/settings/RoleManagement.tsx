import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Shield,
  Lock,
  AlertTriangle,
  History,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import useRoleManagement from '@/hooks/useRoleManagement';
import { Permission, PERMISSION_DESCRIPTIONS, RoleDefinition } from '@/types/permissions';
import { toast } from 'sonner';
import { RoleAuditHistory } from '@/components/roles/RoleAuditHistory';
import { RoleAnalytics } from '@/components/roles/RoleAnalytics';

// Group permissions by category
const PERMISSION_GROUPS: Record<string, Permission[]> = {
  'Quotations': ['create_quotation', 'view_quotation', 'edit_quotation', 'delete_quotation', 'export_quotation'],
  'Invoices': ['create_invoice', 'view_invoice', 'edit_invoice', 'delete_invoice', 'export_invoice'],
  'Credit Notes': ['create_credit_note', 'view_credit_note', 'edit_credit_note', 'delete_credit_note', 'export_credit_note'],
  'Proforma': ['create_proforma', 'view_proforma', 'edit_proforma', 'delete_proforma', 'export_proforma'],
  'Payments': ['create_payment', 'view_payment', 'edit_payment', 'delete_payment'],
  'Inventory': ['create_inventory', 'view_inventory', 'edit_inventory', 'delete_inventory', 'manage_inventory'],
  'Reports': ['view_reports', 'export_reports', 'view_customer_reports', 'view_inventory_reports', 'view_sales_reports'],
  'Customers': ['create_customer', 'view_customer', 'edit_customer', 'delete_customer'],
  'Delivery Notes': ['create_delivery_note', 'view_delivery_note', 'edit_delivery_note', 'delete_delivery_note'],
  'Purchase Orders': ['create_lpo', 'view_lpo', 'edit_lpo', 'delete_lpo'],
  'Remittance': ['create_remittance', 'view_remittance', 'edit_remittance', 'delete_remittance'],
  'User Management': ['create_user', 'edit_user', 'delete_user', 'manage_users', 'approve_users', 'invite_users'],
  'Settings & Admin': ['view_audit_logs', 'manage_roles', 'manage_permissions', 'access_settings'],
};

export function RoleManagement() {
  const { isAdmin, profile } = useAuth();
  const { roles, loading, createRole, updateRole, deleteRole } = useRoleManagement();

  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleDefinition | null>(null);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const [selectedRoleForAudit, setSelectedRoleForAudit] = useState<RoleDefinition | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
    company_id: profile?.company_id || '',
  });

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You need administrator privileges to manage roles and permissions.
        </AlertDescription>
      </Alert>
    );
  }

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const handleCreateRole = async () => {
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRole({
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
        company_id: formData.company_id,
      });

      if (result.success) {
        setCreateDialogOpen(false);
        setFormData({ name: '', description: '', permissions: [], company_id: profile?.company_id || '' });
      } else {
        toast.error(result.error || 'Failed to create role');
      }
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRole = async () => {
    if (!editingRole || !formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateRole(editingRole.id, {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
      });

      if (result.success) {
        setEditDialogOpen(false);
        setEditingRole(null);
        setFormData({ name: '', description: '', permissions: [], company_id: profile?.company_id || '' });
      } else {
        toast.error(result.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;

    const result = await deleteRole(deletingRole.id);

    if (result.success) {
      setDeleteDialogOpen(false);
      setDeletingRole(null);
    }
  };

  const openEditDialog = (role: RoleDefinition) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
      company_id: (role as any).company_id || profile?.company_id || '',
    });
    setEditDialogOpen(true);
  };

  const togglePermission = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const togglePermissionGroup = (group: Permission[]) => {
    const allIncluded = group.every((p) =>
      formData.permissions.includes(p)
    );

    setFormData((prev) => ({
      ...prev,
      permissions: allIncluded
        ? prev.permissions.filter((p) => !group.includes(p))
        : [...prev.permissions, ...group.filter((p) => !prev.permissions.includes(p))],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Role Management</h1>
          <p className="text-muted-foreground">
            Create and manage roles with granular permissions
          </p>
        </div>
        <Button
          variant="primary-gradient"
          size="lg"
          onClick={() => {
            setEditingRole(null);
            setFormData({ name: '', description: '', permissions: [], company_id: profile?.company_id || '' });
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <RoleAnalytics />

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <Input
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {role.is_default ? 'Default' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {role.permissions.length} permissions
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(role)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoleForAudit(role);
                              setAuditHistoryOpen(true);
                            }}
                          >
                            <History className="mr-2 h-4 w-4" />
                            Audit History
                          </DropdownMenuItem>
                          {!role.is_default && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setDeletingRole(role);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Role Dialog */}
      <Dialog
        open={createDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
            setEditingRole(null);
            setFormData({ name: '', description: '', permissions: [], company_id: profile?.company_id || '' });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? `Update role: ${editingRole.name}`
                : 'Create a new role and assign permissions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Role Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Senior Accountant"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={editingRole?.is_default}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Role description and responsibilities"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-3">Permissions</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select permissions for this role. Total selected: {formData.permissions.length}
                </p>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-6">
                  {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => {
                    const allIncluded = permissions.every((p) =>
                      formData.permissions.includes(p)
                    );
                    const someIncluded = permissions.some((p) =>
                      formData.permissions.includes(p)
                    );

                    return (
                      <div key={group}>
                        <div className="flex items-center space-x-2 mb-3">
                          <Checkbox
                            id={`group-${group}`}
                            checked={allIncluded || someIncluded}
                            onCheckedChange={() => togglePermissionGroup(permissions)}
                          />
                          <Label
                            htmlFor={`group-${group}`}
                            className="font-semibold cursor-pointer"
                          >
                            {group}
                          </Label>
                        </div>

                        <div className="space-y-2 ml-6">
                          {permissions.map((permission) => (
                            <div key={permission} className="flex items-start space-x-2">
                              <Checkbox
                                id={permission}
                                checked={formData.permissions.includes(permission)}
                                onCheckedChange={() => togglePermission(permission)}
                              />
                              <Label
                                htmlFor={permission}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                <div className="flex flex-col">
                                  <span className="capitalize">
                                    {permission.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {PERMISSION_DESCRIPTIONS[permission]}
                                  </span>
                                </div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditDialogOpen(false);
                setEditingRole(null);
                setFormData({ name: '', description: '', permissions: [], company_id: profile?.company_id || '' });
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={editingRole ? handleEditRole : handleCreateRole}
              disabled={submitting || !formData.name.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingRole ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingRole ? 'Update Role' : 'Create Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deletingRole?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit History Dialog */}
      <Dialog open={auditHistoryOpen} onOpenChange={setAuditHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Audit History
            </DialogTitle>
            <DialogDescription>
              View all changes made to role: {selectedRoleForAudit?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            {selectedRoleForAudit && (
              <RoleAuditHistory
                roleId={selectedRoleForAudit.id}
                roleName={selectedRoleForAudit.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
