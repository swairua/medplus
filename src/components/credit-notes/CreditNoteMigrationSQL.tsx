import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

export function CreditNoteMigrationSQL() {
  return (
    <Card className="border-success bg-success-light/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <CheckCircle className="h-5 w-5" />
          Credit Notes Schema Ready
          <Badge variant="outline" className="bg-success text-success-foreground">
            Migration Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Credit Notes are fully configured!</strong><br />
            The credit note tables and functions are now part of the main database schema.
            You can create, manage, and apply credit notes without any additional setup.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
