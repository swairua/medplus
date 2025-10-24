import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Download } from 'lucide-react';

interface RoleAuditHistoryProps {
  roleId: string;
  roleName: string;
}

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  record_id: string | null;
  actor_email: string | null;
  actor_user_id: string | null;
  details: any;
}

async function fetchRoleAuditLogs(roleId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('record_id', roleId)
    .eq('entity_type', 'role')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

function formatActionBadge(action: string) {
  const colors: Record<string, string> = {
    CREATE: 'bg-success-light text-success border-success/20',
    UPDATE: 'bg-primary-light text-primary border-primary/20',
    DELETE: 'bg-destructive-light text-destructive border-destructive/20',
    APPROVE: 'bg-warning-light text-warning border-warning/20',
  };
  return colors[action] || 'bg-muted text-muted-foreground border-muted-foreground/20';
}

function PermissionChanges({ details }: { details: any }) {
  if (!details) return null;

  const permissionChanges = details.permission_changes;
  if (!permissionChanges && !details.permissions) return null;

  return (
    <div className="space-y-3 text-sm">
      {permissionChanges && (
        <>
          {permissionChanges.added && permissionChanges.added.length > 0 && (
            <div>
              <span className="font-semibold text-success">✓ Permissions Added ({permissionChanges.added.length}):</span>
              <div className="space-y-1 ml-2 mt-1">
                {permissionChanges.added.slice(0, 8).map((perm: string) => (
                  <div
                    key={perm}
                    className="text-xs bg-success-light text-success px-2 py-1 rounded"
                  >
                    {perm.replace(/_/g, ' ')}
                  </div>
                ))}
                {permissionChanges.added.length > 8 && (
                  <div className="text-xs text-muted-foreground">
                    +{permissionChanges.added.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}

          {permissionChanges.removed && permissionChanges.removed.length > 0 && (
            <div>
              <span className="font-semibold text-destructive">✕ Permissions Removed ({permissionChanges.removed.length}):</span>
              <div className="space-y-1 ml-2 mt-1">
                {permissionChanges.removed.slice(0, 8).map((perm: string) => (
                  <div
                    key={perm}
                    className="text-xs bg-destructive-light text-destructive px-2 py-1 rounded"
                  >
                    {perm.replace(/_/g, ' ')}
                  </div>
                ))}
                {permissionChanges.removed.length > 8 && (
                  <div className="text-xs text-muted-foreground">
                    +{permissionChanges.removed.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-1 border-t">
            Total permissions after change: {permissionChanges.total_permissions}
          </div>
        </>
      )}
    </div>
  );
}

export function RoleAuditHistory({ roleId, roleName }: RoleAuditHistoryProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['role_audit_logs', roleId],
    queryFn: () => fetchRoleAuditLogs(roleId),
    staleTime: 30_000,
  });

  const filteredLogs = useMemo(() => {
    if (!searchFilter) return logs;
    const q = searchFilter.toLowerCase();
    return logs.filter((log: AuditLog) =>
      String(log.action || '').toLowerCase().includes(q) ||
      String(log.actor_email || '').toLowerCase().includes(q) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(q)
    );
  }, [logs, searchFilter]);

  const exportLogs = () => {
    const csv = [
      ['Date', 'Action', 'Actor', 'Details'].join(','),
      ...filteredLogs.map((log: AuditLog) =>
        [
          new Date(log.created_at).toLocaleString(),
          log.action,
          log.actor_email || 'System',
          JSON.stringify(log.details || {}),
        ].map(field => `"${String(field).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `role-${roleName}-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Audit History for {roleName}</CardTitle>
        {!isLoading && logs.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Search audit history..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="max-w-md"
        />

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No audit history found for this role
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: AuditLog) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={formatActionBadge(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actor_email || log.actor_user_id || 'System'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailsOpen(detailsOpen === log.id ? null : log.id)}
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            detailsOpen === log.id ? 'rotate-180' : ''
                          }`}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {detailsOpen && (
              <div className="border-t bg-muted/30 p-4">
                {filteredLogs.find((l: AuditLog) => l.id === detailsOpen) && (
                  <div className="space-y-3">
                    {filteredLogs.find((l: AuditLog) => l.id === detailsOpen)?.details?.permissions ? (
                      <PermissionChanges
                        details={filteredLogs.find((l: AuditLog) => l.id === detailsOpen)?.details}
                      />
                    ) : null}
                    <div>
                      <span className="font-semibold text-sm text-muted-foreground">Full Details:</span>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-2">
                        {JSON.stringify(
                          filteredLogs.find((l: AuditLog) => l.id === detailsOpen)?.details || {},
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
