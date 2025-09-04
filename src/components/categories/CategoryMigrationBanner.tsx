import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

export const CategoryMigrationBanner = () => {
  return (
    <Card className="mb-4 border-success bg-success-light/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <CheckCircle className="h-5 w-5" />
          Categories Enhanced
          <Badge variant="outline" className="bg-success text-success-foreground">
            Ready to Use
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Categories Enhanced!</strong> You can now use hierarchical categories, 
            color coding, custom ordering, and unique category codes. All features are ready to use.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
