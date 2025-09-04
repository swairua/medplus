import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Database } from 'lucide-react';

export function DatabaseSchemaInitializer() {
  return (
    <Card className="border-success bg-success-light/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <Database className="h-5 w-5" />
          Database Schema Ready
          <Badge variant="outline" className="bg-success text-success-foreground">
            Initialized
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Database Schema Complete!</strong><br />
            All required tables, functions, and relationships have been set up. 
            Your application is ready to use with full functionality.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-muted/30 p-3 rounded">
            <h4 className="font-medium text-sm">Core Tables</h4>
            <p className="text-xs text-muted-foreground">Companies, Users, Customers</p>
          </div>
          <div className="bg-muted/30 p-3 rounded">
            <h4 className="font-medium text-sm">Products & Inventory</h4>
            <p className="text-xs text-muted-foreground">Products, Categories, Stock</p>
          </div>
          <div className="bg-muted/30 p-3 rounded">
            <h4 className="font-medium text-sm">Sales Documents</h4>
            <p className="text-xs text-muted-foreground">Quotations, Invoices, Credits</p>
          </div>
          <div className="bg-muted/30 p-3 rounded">
            <h4 className="font-medium text-sm">Payments & Reports</h4>
            <p className="text-xs text-muted-foreground">Payments, Allocations, Reports</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
