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
import { AlertTriangle, Trash2, Truck } from 'lucide-react';

interface DeleteDeliveryNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNote: {
    id: string;
    delivery_number?: string;
    delivery_note_number?: string;
    delivery_date: string;
    status: string;
    customers?: {
      name: string;
    };
    delivery_note_items?: Array<any>;
  } | null;
  isDeleting?: boolean;
  onConfirm: (deliveryNoteId: string) => Promise<void>;
}

export function DeleteDeliveryNoteModal({
  open,
  onOpenChange,
  deliveryNote,
  isDeleting = false,
  onConfirm,
}: DeleteDeliveryNoteModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!deliveryNote) return null;

  const deliveryNumber = deliveryNote.delivery_number || deliveryNote.delivery_note_number;
  const itemCount = deliveryNote.delivery_note_items?.length || 0;
  const deliveryDate = new Date(deliveryNote.delivery_date).toLocaleDateString();

  const handleConfirm = async () => {
    if (confirmed) {
      await onConfirm(deliveryNote.id);
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
            <span>Delete Delivery Note</span>
          </DialogTitle>
          <DialogDescription>
            This action will delete the delivery note and reverse all inventory adjustments. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Delivery Note Details */}
          <div className="space-y-3 rounded-lg bg-muted p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Delivery Note</p>
                <p className="text-sm text-muted-foreground font-mono">{deliveryNumber}</p>
              </div>
              <Badge variant="outline" className="capitalize">
                {deliveryNote.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{deliveryNote.customers?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{deliveryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items:</span>
                <span className="font-medium">{itemCount}</span>
              </div>
            </div>
          </div>

          {/* Warning Alert */}
          <Alert className="border-destructive-light bg-destructive-light/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Inventory Impact</AlertTitle>
            <AlertDescription className="mt-2 text-destructive/90">
              Deleting this delivery note will:
              <ul className="mt-2 ml-2 space-y-1 list-disc">
                <li>Remove {itemCount} delivery item(s)</li>
                <li>Reverse all stock movements and restore inventory quantities</li>
                <li>Remove all related records permanently</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Confirmation Checkbox */}
          <div className="space-y-3 rounded-lg border border-muted p-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-muted-foreground"
              />
              <span className="text-sm font-medium">
                I understand and want to delete this delivery note and reverse all inventory changes
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
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
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!confirmed || isDeleting}
            className="flex items-center space-x-2"
          >
            <Trash2 className="h-4 w-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Delivery Note'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
