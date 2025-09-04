import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package } from 'lucide-react';

export function StockMovementsSetup() {
  return (
    <Card className="border-success bg-success-light/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <Package className="h-5 w-5" />
          Stock Movements Ready
          <Badge variant="outline" className="bg-success text-success-foreground">
            Configured
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Inventory Tracking Enabled!</strong><br />
            The stock movements table and functions are configured. Your inventory will be automatically 
            tracked for credit notes, invoices, and stock adjustments.
          </AlertDescription>
        </Alert>
        
        <div className="bg-muted/50 p-4 rounded-lg mt-4">
          <h4 className="font-medium mb-2 flex items-center">
            <Package className="h-4 w-4 mr-2 text-primary" />
            Available Features:
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Automatic stock tracking for all inventory movements</li>
            <li>Integration with invoices and credit notes</li>
            <li>Manual stock adjustments and restocking</li>
            <li>Complete audit trail of all stock changes</li>
            <li>Real-time stock level updates</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
