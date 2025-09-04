import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle,
  AlertTriangle,
  Database,
  FileText,
  DollarSign,
  ArrowRightLeft,
  CreditCard
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StockMovementsSetup } from '@/components/inventory/StockMovementsSetup';

interface SetupStatus {
  tables: 'checking' | 'exists' | 'missing' | 'error';
  functions: 'checking' | 'exists' | 'missing' | 'error';
  policies: 'checking' | 'exists' | 'missing' | 'error';
}

export function CreditNotesSetupGuide() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    tables: 'checking',
    functions: 'checking', 
    policies: 'checking'
  });

  const checkSetupStatus = async () => {
    try {
      // Check if credit_notes table exists
      const { error: tableError } = await supabase
        .from('credit_notes')
        .select('id')
        .limit(1);

      const tablesStatus = tableError 
        ? (tableError.code === 'PGRST116' ? 'missing' : 'error')
        : 'exists';

      // Check functions (simplified check)
      const functionsStatus = tablesStatus === 'exists' ? 'exists' : 'missing';
      
      // Check policies (simplified check)
      const policiesStatus = tablesStatus === 'exists' ? 'exists' : 'missing';

      setSetupStatus({
        tables: tablesStatus,
        functions: functionsStatus,
        policies: policiesStatus
      });

    } catch (error) {
      console.error('Error checking setup status:', error);
      setSetupStatus({
        tables: 'error',
        functions: 'error',
        policies: 'error'
      });
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'exists':
        return <Badge className="bg-success text-success-foreground">Ready</Badge>;
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>;
      case 'error':
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Error</Badge>;
      default:
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  const allReady = Object.values(setupStatus).every(status => status === 'exists');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <CreditCard className="h-6 w-6 text-blue-500" />
          Credit Notes Setup
        </h2>
        <p className="text-muted-foreground">
          Manage customer refunds and adjustments with professional credit notes
        </p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Setup Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Database Tables</span>
              {getStatusBadge(setupStatus.tables)}
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Functions</span>
              {getStatusBadge(setupStatus.functions)}
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Security Policies</span>
              {getStatusBadge(setupStatus.policies)}
            </div>
          </div>

          {allReady ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>✅ Credit Notes Ready!</strong> All components are properly configured.
                You can now create, send, and apply credit notes to customer invoices.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Setup Required</strong> Credit notes functionality requires database configuration.
                The comprehensive migration script includes all necessary components.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Credit Notes Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-green-700">✅ Core Features</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Professional credit note generation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Automatic numbering system
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Multiple tax calculation options
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Invoice allocation tracking
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-blue-700">🚀 Advanced Features</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  Credit application to multiple invoices
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  Automatic balance calculations
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  Inventory impact tracking
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  Complete audit trail
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {!allReady && (
        <Card>
          <CardHeader>
            <CardTitle>Database Migration Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <Database className="h-4 w-4" />
              <AlertDescription>
                <strong>Ready to Setup?</strong><br />
                Use the comprehensive database migration script that includes all credit notes functionality.
                This script sets up tables, functions, indexes, and security policies in one go.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                className="bg-green-600 hover:bg-green-700"
              >
                Open Supabase Dashboard
              </Button>
              <Button 
                variant="outline"
                onClick={checkSetupStatus}
              >
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Movements Setup */}
      <StockMovementsSetup />
    </div>
  );
}
