import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

async function fetchAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export default function AuditLogsPage() {
  const [filter, setFilter] = React.useState('');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: fetchAuditLogs,
    staleTime: 30_000,
  });

  const filtered = React.useMemo(() => {
    if (!filter) return logs;
    const q = filter.toLowerCase();
    return logs.filter((l: any) =>
      String(l.entity_type || '').toLowerCase().includes(q) ||
      String(l.action || '').toLowerCase().includes(q) ||
      String(l.record_id || '').toLowerCase().includes(q) ||
      String(l.actor_email || '').toLowerCase().includes(q) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(q)
    );
  }, [logs, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">View recent deletion audit events and details</p>
        </div>
        <div className="flex items-center space-x-2">
          <Input placeholder="Search logs..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-64" />
          <button className="btn" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">{new Date(log.created_at).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell className="font-mono text-sm">{log.record_id}</TableCell>
                    <TableCell>{log.actor_email || log.actor_user_id || 'System'}</TableCell>
                    <TableCell className="font-mono text-sm">{log.company_id || '-'}</TableCell>
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-sm text-muted-foreground">View</summary>
                        <pre className="whitespace-pre-wrap text-xs mt-2 bg-muted p-2 rounded">{JSON.stringify(log.details || {}, null, 2)}</pre>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
