import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Copy, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export function ManualFunctionSetupGuide() {
  const [copied, setCopied] = useState(false);

  const functionSQL = `CREATE OR REPLACE FUNCTION record_payment_with_allocation(
    p_company_id UUID,
    p_customer_id UUID,
    p_invoice_id UUID,
    p_payment_number VARCHAR(50),
    p_payment_date DATE,
    p_amount DECIMAL(15,2),
    p_payment_method payment_method,
    p_reference_number VARCHAR(100),
    p_notes TEXT
)
RETURNS JSON AS $$
DECLARE
    v_payment_id UUID;
    v_invoice_record RECORD;
BEGIN
    -- Validate invoice exists and get details
    SELECT id, total_amount, paid_amount, balance_due 
    INTO v_invoice_record 
    FROM invoices 
    WHERE id = p_invoice_id AND company_id = p_company_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    -- Insert payment
    INSERT INTO payments (
        company_id, customer_id, payment_number, payment_date, 
        amount, payment_method, reference_number, notes
    ) VALUES (
        p_company_id, p_customer_id, p_payment_number, p_payment_date,
        p_amount, p_payment_method, p_reference_number, p_notes
    ) RETURNING id INTO v_payment_id;

    -- Insert payment allocation
    INSERT INTO payment_allocations (payment_id, invoice_id, amount_allocated)
    VALUES (v_payment_id, p_invoice_id, p_amount);

    -- Update invoice payment status
    UPDATE invoices 
    SET 
        paid_amount = COALESCE(paid_amount, 0) + p_amount,
        balance_due = total_amount - (COALESCE(paid_amount, 0) + p_amount),
        status = CASE 
            WHEN (COALESCE(paid_amount, 0) + p_amount) >= total_amount THEN 'paid'
            WHEN (COALESCE(paid_amount, 0) + p_amount) > 0 THEN 'partial'
            ELSE status 
        END,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    RETURN json_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'amount_allocated', p_amount,
        'invoice_balance', v_invoice_record.total_amount - (COALESCE(v_invoice_record.paid_amount, 0) + p_amount)
    );
END;
$$ LANGUAGE plpgsql;`;

  const handleCopy = () => {
    navigator.clipboard.writeText(functionSQL);
    setCopied(true);
    toast.success('SQL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          Manual Database Function Setup Required
        </CardTitle>
        <CardDescription>
          The payment synchronization function needs to be created manually in your Supabase dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-info/30 bg-info/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Steps to complete setup:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Copy the SQL code below</li>
              <li>Go to your Supabase dashboard</li>
              <li>Open the SQL Editor (from the left sidebar)</li>
              <li>Create a new query and paste the SQL</li>
              <li>Run the query</li>
              <li>Refresh this page - the status will update automatically</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Database Function SQL:</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy SQL
                </>
              )}
            </Button>
          </div>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs border border-slate-700 max-h-96">
              <code>{functionSQL}</code>
            </pre>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open('https://app.supabase.com/project/_/sql/new', '_blank');
            }}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Supabase SQL Editor
          </Button>
        </div>

        <Alert className="border-success/30 bg-success/5">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">
            Once you've run the SQL in Supabase, refresh this page and the payment system will work automatically.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
