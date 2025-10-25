import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { UserRole } from '@/contexts/AuthContext';
import { validateEmail } from '@/utils/validation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteUser: (email: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  loading?: boolean;
}

export function InviteUserModal({
  open,
  onOpenChange,
  onInviteUser,
  loading = false,
}: InviteUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    role: 'user' as UserRole,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.role) {
      errors.role = 'Role is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const result = await onInviteUser(formData.email, formData.role);
    
    if (result.success) {
      handleClose();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      email: '',
      role: 'user',
    });
    setFormErrors({});
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setFormData(prev => ({ ...prev, role }));
    if (formErrors.role) {
      setFormErrors(prev => ({ ...prev, role: '' }));
    }
  };

  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string; description?: string }[]>([]);
  const { profile: currentUser } = useAuth();
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    if (open && currentUser?.company_id) {
      fetchRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUser?.company_id]);

  const fetchRoles = async () => {
    if (!currentUser?.company_id) return;
    setRolesLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id,name,description')
        .eq('company_id', currentUser.company_id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      const options = (data || []).map((r: any) => ({ value: r.name, label: r.name, description: r.description }));
      setRoleOptions(options.length ? options : [{ value: 'user', label: 'User', description: 'Default role' }]);
    } catch (err) {
      console.error('Error fetching roles for invite modal:', err);
      setRoleOptions([{ value: 'user', label: 'User', description: 'Default role' }]);
    } finally {
      setRolesLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation email to a new user to join your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="user@company.com"
                value={formData.email}
                onChange={handleInputChange('email')}
                className={`pl-10 ${formErrors.email ? 'border-destructive' : ''}`}
                disabled={loading}
              />
            </div>
            {formErrors.email && (
              <p className="text-sm text-destructive">{formErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={formData.role} onValueChange={handleRoleChange} disabled={loading}>
              <SelectTrigger className={formErrors.role ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {rolesLoading ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">Loading roles...</div>
                ) : roleOptions.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No roles available</div>
                ) : (
                  roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {formErrors.role && (
              <p className="text-sm text-destructive">{formErrors.role}</p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• An invitation email will be sent to the user</li>
              <li>• They can click the link to create their account</li>
              <li>• Their account will be created with the selected role</li>
              <li>• The invitation expires in 7 days</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
