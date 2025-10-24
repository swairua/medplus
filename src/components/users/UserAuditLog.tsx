import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, LogIn, CheckCircle, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  record_id: string | null;
  company_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  details: any;
}

function getActionColor(action: string) {
  switch (action) {
    case 'CREATE':
      return 'bg-blue-light text-blue border-blue/20';
    case 'APPROVE':
      return 'bg-success-light text-success border-success/20';
    case 'INVITE':
      return 'bg-primary-light text-primary border-primary/20';
    case 'DELETE':
      return 'bg-destructive-light text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case 'CREATE':
      return <UserPlus className="h-4 w-4" />;
    case 'APPROVE':
      return <CheckCircle className="h-4 w-4" />;
    case 'INVITE':
      return <LogIn className="h-4 w-4" />;
    default:
      return null;
  }
}

interface UserAuditLogProps {
  limit?: number;
}

export function UserAuditLog({ limit = 50 }: UserAuditLogProps) {
  const { profile: currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by user creation and approval events
      query = query.in('entity_type', ['user_creation', 'user_invitation']);

      // If user belongs to a company, filter to that company
      if (currentUser?.company_id) {
        query = query.eq('company_id', currentUser.company_id);
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.actor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.invited_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.user_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = !actionFilter || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>User Audit Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Actions</SelectItem>
              <SelectItem value="CREATE">User Creation</SelectItem>
              <SelectItem value="APPROVE">User Approval</SelectItem>
              <SelectItem value="INVITE">User Invitation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading audit logs...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const userEmail =
                    log.details?.invited_email ||
                    log.details?.user_email ||
                    'Unknown';

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.created_at).toLocaleDateString()}{' '}
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getActionIcon(log.action)}
                          <Badge
                            variant="outline"
                            className={getActionColor(log.action)}
                          >
                            {log.action}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{userEmail}</p>
                        {log.details?.invited_role && (
                          <p className="text-xs text-muted-foreground">
                            Role: {log.details.invited_role.replace('_', ' ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{log.actor_email || 'System'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {log.action === 'CREATE' && (
                            <p>User invitation created</p>
                          )}
                          {log.action === 'APPROVE' && (
                            <p>
                              Approval Status:{' '}
                              <span className="font-medium text-success">
                                {log.details?.approval_status ||
                                  'approved'}
                              </span>
                            </p>
                          )}
                          {log.action === 'INVITE' && (
                            <p>User was invited</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredLogs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
