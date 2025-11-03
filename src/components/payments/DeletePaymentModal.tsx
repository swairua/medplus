import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useDeletePayment } from '@/hooks/useDatabase';

interface DeletePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  payment?: {
    id: string;
    payment_number: string;
    amount: number;
    payment_date: string;
    customers?: {
      name: string;
    };
    payment_allocations?: Array<{
      invoice_number: string;
      amount_allocated: number;
    }>;
  };
}

export function DeletePaymentModal({
  open,
  onOpenChange,
  onSuccess,
  payment,
}: DeletePaymentModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deletePaymentMutation = useDeletePayment();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleDelete = async () => {
    if (!payment?.id) {
      toast.error('Payment not found');
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deletePaymentMutation.mutateAsync(payment.id);

      toast.success(`Payment ${payment.payment_number} deleted successfully!`, {
        description: `Invoice balances updated for ${result.invoices_updated} invoice(s)`
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete payment';
      toast.error(errorMessage, {
        duration: 6000,
        description: 'Please try again or contact support'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>Delete Payment</span>
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete the payment and reverse all invoice updates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Box */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive text-sm">This cannot be undone</p>
                <p className="text-sm text-destructive/80 mt-1">
                  Deleting this payment will automatically reverse all related invoice balance updates.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Payment Number</p>
              <p className="font-medium">{payment.payment_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium text-sm">{payment.customers?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-medium text-sm text-destructive">
                  {formatCurrency(payment.amount)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium text-sm">
                {new Date(payment.payment_date).toLocaleDateString()}
              </p>
            </div>

            {/* Allocations */}
            {payment.payment_allocations && payment.payment_allocations.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Invoices Affected</p>
                <div className="space-y-1">
                  {payment.payment_allocations.map((alloc, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{alloc.invoice_number}</span>
                      <span className="font-medium">-{formatCurrency(alloc.amount_allocated)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirmation Text */}
          <div className="bg-info/10 border border-info/20 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              ℹ️ When you delete this payment:
              <br />
              • Payment amount will be deducted from invoice balances
              <br />
              • Invoice statuses will be recalculated
              <br />
              • Payment allocations will be removed
            </p>
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center space-x-2"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Payment'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
