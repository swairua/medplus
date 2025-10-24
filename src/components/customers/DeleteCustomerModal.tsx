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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string;
    customer_code: string;
    email?: string;
    phone?: string;
    credit_limit?: number;
    is_active?: boolean;
  } | null;
  relatedRecordsCounts?: {
    invoices?: number;
    quotations?: number;
    credit_notes?: number;
    delivery_notes?: number;
    payments?: number;
    lpos_as_supplier?: number;
  };
  isDeleting?: boolean;
  onConfirm: (customerId: string) => Promise<void>;
}

export function DeleteCustomerModal({
  open,
  onOpenChange,
  customer,
  relatedRecordsCounts = {},
  isDeleting = false,
  onConfirm,
}: DeleteCustomerModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!customer) return null;

  const counts = relatedRecordsCounts ?? {};

  const totalRelatedRecords =
    (counts.invoices || 0) +
    (counts.quotations || 0) +
    (counts.credit_notes || 0) +
    (counts.delivery_notes || 0) +
    (counts.payments || 0) +
    (counts.lpos_as_supplier || 0);

  const hasLPOAsSupplier = (counts.lpos_as_supplier || 0) > 0;

  const handleConfirm = async () => {
    if (confirmed) {
      await onConfirm(customer.id);
      setConfirmed(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Delete Customer</span>
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please review the details before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Details */}
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Customer</p>
                <p className="text-sm text-muted-foreground">{customer.customer_code}</p>
              </div>
              <Badge variant="outline">
                {customer.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{customer.name}</span>
              </div>
              {customer.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-xs">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{customer.phone}</span>
                </div>
              )}
              {customer.credit_limit && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Limit:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                    }).format(customer.credit_limit)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Critical Warning for Suppliers */}
          {hasLPOAsSupplier && (
            <Alert className="border-destructive-light bg-destructive-light/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive">Critical: Supplier Usage</AlertTitle>
              <AlertDescription className="mt-2 text-destructive/90">
                This customer is used as a supplier in {counts.lpos_as_supplier}
                purchase order(s). Deleting this customer will permanently remove all related purchase
                orders and their items. This cannot be undone.
              </AlertDescription>
            </Alert>
          )}

          {/* Impact Summary */}
          {totalRelatedRecords > 0 && (
            <Alert className={`border-warning-light ${hasLPOAsSupplier ? 'bg-muted' : 'bg-warning-light/10'}`}>
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle>Related Records</AlertTitle>
              <AlertDescription className="mt-2 space-y-1">
                <div>The following records will be deleted:</div>
                {counts.invoices && counts.invoices > 0 && (
                  <div>• {counts.invoices} invoice(s)</div>
                )}
                {counts.quotations && counts.quotations > 0 && (
                  <div>• {counts.quotations} quotation(s)</div>
                )}
                {counts.credit_notes && counts.credit_notes > 0 && (
                  <div>• {counts.credit_notes} credit note(s)</div>
                )}
                {counts.delivery_notes && counts.delivery_notes > 0 && (
                  <div>• {counts.delivery_notes} delivery note(s)</div>
                )}
                {counts.payments && counts.payments > 0 && (
                  <div>• {counts.payments} payment(s)</div>
                )}
                {counts.lpos_as_supplier && counts.lpos_as_supplier > 0 && (
                  <div>• {counts.lpos_as_supplier} purchase order(s) as supplier</div>
                )}
                <div className="mt-2 text-xs">A complete audit log will be recorded.</div>
              </AlertDescription>
            </Alert>
          )}

          {/* Confirmation Checkbox */}
          <div className="flex items-start space-x-3 rounded-lg bg-destructive-light/10 p-3">
            <input
              type="checkbox"
              id="confirm-delete"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 accent-destructive"
            />
            <label htmlFor="confirm-delete" className="text-sm font-medium cursor-pointer">
              I understand this action cannot be undone and all related records will be permanently deleted
            </label>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setConfirmed(false);
              onOpenChange(false);
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!confirmed || isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
