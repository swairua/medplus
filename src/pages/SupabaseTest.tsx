import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConnectionStatus {
  connected: boolean;
  tablesCount: number;
  error?: string;
  tables: string[];
}

export default function SupabaseTest() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    tablesCount: 0,
    tables: []
  });
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      // Test basic connection by checking companies table
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .limit(5);

      if (companiesError) {
        setStatus({
          connected: false,
          tablesCount: 0,
          error: companiesError.message,
          tables: []
        });
        toast.error('Connection failed: ' + companiesError.message);
        return;
      }

      // Test other tables to see what's available
      const tablesToTest = [
        'companies', 'customers', 'products', 'product_categories',
        'quotations', 'invoices', 'payments', 'credit_notes', 'stock_movements'
      ];

      const availableTables: string[] = [];
      
      for (const table of tablesToTest) {
        try {
          const { error } = await supabase
            .from(table)
            .select('id')
            .limit(1);
          
          if (!error) {
            availableTables.push(table);
          }
        } catch (e) {
          // Table doesn't exist, skip
        }
      }

      setStatus({
        connected: true,
        tablesCount: availableTables.length,
        tables: availableTables
      });

      toast.success(`Connected! Found ${availableTables.length} tables`);

    } catch (error: any) {
      setStatus({
        connected: false,
        tablesCount: 0,
        error: error.message,
        tables: []
      });
      toast.error('Connection failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className="h-8 w-8 text-blue-500" />
          Supabase Connection Test
        </h1>
        <p className="text-muted-foreground">
          Verify database connection and check available tables
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Connection Status
            </div>
            <Button
              onClick={testConnection}
              disabled={testing}
              variant="outline"
              size="sm"
            >
              {testing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="font-medium">Connection:</span>
            {status.connected ? (
              <Badge className="bg-success text-success-foreground">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="font-medium">Tables Found:</span>
            <Badge variant="outline">
              {status.tablesCount} tables
            </Badge>
          </div>

          {status.error && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Connection Error:</strong> {status.error}
              </AlertDescription>
            </Alert>
          )}

          {status.connected && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Successfully connected to Supabase!</strong> 
                Database is accessible and ready for use.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {status.tables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {status.tables.map((table) => (
                <div
                  key={table}
                  className="p-2 border rounded text-sm font-mono bg-muted/30"
                >
                  {table}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Database Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">URL:</span>
              <div className="font-mono text-muted-foreground">
                https://mfhcbgnkxpifbhrtmgbv.supabase.co
              </div>
            </div>
            <div>
              <span className="font-medium">Project:</span>
              <div className="font-mono text-muted-foreground">
                mfhcbgnkxpifbhrtmgbv
              </div>
            </div>
          </div>
          
          <Alert className="mt-4">
            <Database className="h-4 w-4" />
            <AlertDescription>
              <strong>Migration Ready:</strong> Use the COMPREHENSIVE_DATABASE_MIGRATION.sql 
              script to set up the complete database schema with all tables, functions, and relationships.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
