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

interface DeleteLPOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lpo: {
    id: string;
    lpo_number: string;
    status: string;
    total_amount?: number;
    suppliers?: {
      name: string;
    };
  } | null;
  relatedRecordsCounts?: {
    items?: number;
    received_items?: number;
    invoices?: number;
  };
  isDeleting?: boolean;
  onConfirm: (lpoId: string) => Promise<void>;
}

export function DeleteLPOModal({
  open,
  onOpenChange,
  lpo,
  relatedRecordsCounts = {},
  isDeleting = false,
  onConfirm,
}: DeleteLPOModalProps) {
  const [confirmed, setConfirm] = useState(false);

  if (!lpo) return null;

  const counts = relatedRecordsCounts ?? {};

  const totalRelatedRecords =
    (counts.items || 0) +
    (counts.received_items || 0) +
    (counts.invoices || 0);

  const handleConfirm = async () => {
    if (confirmed) {
      await onConfirm(lpo.id);
      setConfirm(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Delete Purchase Order</span>
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please review the details before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* LPO Details */}
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Purchase Order</p>
                <p className="text-sm text-muted-foreground">{lpo.lpo_number}</p>
              </div>
              <Badge variant="outline">{lpo.status}</Badge>
            </div>

            <div className="space-y-2 text-sm">
              {lpo.suppliers?.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">{lpo.suppliers.name}</span>
                </div>
              )}
              {lpo.total_amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(lpo.total_amount)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Impact Summary */}
          {totalRelatedRecords > 0 && (
            <Alert className="border-warning-light bg-warning-light/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle>Impact of Deletion</AlertTitle>
              <AlertDescription className="mt-2 space-y-1">
                <div>The following records will be deleted:</div>
                {counts.items && counts.items > 0 && (
                  <div>• {relatedRecordsCounts.items} line item(s)</div>
                )}
                {counts.received_items && counts.received_items > 0 && (
                  <div>• {relatedRecordsCounts.received_items} received item record(s)</div>
                )}
                {counts.invoices && counts.invoices > 0 && (
                  <div>• {relatedRecordsCounts.invoices} related invoice(s)</div>
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
              onChange={(e) => setConfirm(e.target.checked)}
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
              setConfirm(false);
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
            Delete Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
