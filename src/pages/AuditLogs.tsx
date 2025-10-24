import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Download, ChevronDown } from 'lucide-react';

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  record_id: string | null;
  actor_email: string | null;
  actor_user_id: string | null;
  company_id: string | null;
  details: any;
}

async function fetchAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return data || [];
}

function getActionColor(action: string) {
  const colors: Record<string, string> = {
    DELETE: 'bg-destructive-light text-destructive border-destructive/20',
    CREATE: 'bg-success-light text-success border-success/20',
    UPDATE: 'bg-primary-light text-primary border-primary/20',
    APPROVE: 'bg-warning-light text-warning border-warning/20',
    INVITE: 'bg-blue-light text-blue border-blue/20',
  };
  return colors[action] || 'bg-muted text-muted-foreground border-muted-foreground/20';
}

export default function AuditLogsPage() {
  const [filter, setFilter] = React.useState('');
  const [entityTypeFilter, setEntityTypeFilter] = React.useState<string>('');
  const [actionFilter, setActionFilter] = React.useState<string>('');
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: fetchAuditLogs,
    staleTime: 30_000,
  });

  const entityTypes = React.useMemo(
    () => [...new Set(logs.map((l: AuditLog) => l.entity_type))].sort(),
    [logs]
  );

  const actions = React.useMemo(
    () => [...new Set(logs.map((l: AuditLog) => l.action))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    if (!filter && !entityTypeFilter && !actionFilter) return logs;

    return logs.filter((l: AuditLog) => {
      const q = filter.toLowerCase();
      const matchesSearch =
        !q ||
        String(l.entity_type || '').toLowerCase().includes(q) ||
        String(l.action || '').toLowerCase().includes(q) ||
        String(l.record_id || '').toLowerCase().includes(q) ||
        String(l.actor_email || '').toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q);

      const matchesEntityType = !entityTypeFilter || l.entity_type === entityTypeFilter;
      const matchesAction = !actionFilter || l.action === actionFilter;

      return matchesSearch && matchesEntityType && matchesAction;
    });
  }, [logs, filter, entityTypeFilter, actionFilter]);

  const exportLogs = () => {
    const csv = [
      ['Date', 'Action', 'Entity Type', 'Record ID', 'Actor', 'Company ID', 'Details'].join(','),
      ...filtered.map((log: AuditLog) =>
        [
          new Date(log.created_at).toLocaleString(),
          log.action,
          log.entity_type,
          log.record_id || '',
          log.actor_email || log.actor_user_id || 'System',
          log.company_id || '',
          JSON.stringify(log.details || {}),
        ]
          .map(field => `"${String(field).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleRowExpansion = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">View system events and track all changes</p>
        </div>
        {!isLoading && logs.length > 0 && (
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Search
              </label>
              <Input
                placeholder="Search logs..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Entity Type
              </label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Entity Types</SelectItem>
                  {entityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Action
              </label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length} of {logs.length} events
            </p>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log: AuditLog) => (
                    <React.Fragment key={log.id}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <div className="text-sm">
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                          {log.record_id || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.actor_email || log.actor_user_id || 'System'}
                        </TableCell>
                        <TableCell className="text-right">
                          {Object.keys(log.details || {}).length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(log.id)}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  expandedRows.has(log.id) ? 'rotate-180' : ''
                                }`}
                              />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {expandedRows.has(log.id) && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-muted-foreground">Details:</p>
                              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.details || {}, null, 2)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
