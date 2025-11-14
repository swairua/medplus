import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateQuotationStatus } from '@/hooks/useQuotationItems';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChangeQuotationStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  currentStatus: string;
  quotationNumber: string;
  onSuccess?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
] as const;

export function ChangeQuotationStatusModal({
  open,
  onOpenChange,
  quotationId,
  currentStatus,
  quotationNumber,
  onSuccess
}: ChangeQuotationStatusModalProps) {
  const [newStatus, setNewStatus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const updateStatus = useUpdateQuotationStatus();

  const handleStatusChange = (value: string) => {
    setNewStatus(value);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!newStatus) {
      toast.error('Please select a status');
      return;
    }

    try {
      await updateStatus.mutateAsync({
        quotationId,
        status: newStatus as any,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setNewStatus('');
      setNotes('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const isLoading = updateStatus.isPending;
  const canSubmit = newStatus && newStatus !== currentStatus && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Quotation Status</DialogTitle>
          <DialogDescription>
            Update the status for quotation {quotationNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div className="text-sm font-medium text-muted-foreground">
              {STATUS_OPTIONS.find(opt => opt.value === currentStatus)?.label || currentStatus}
            </div>
          </div>

          {/* New Status Selector */}
          <div className="space-y-2">
            <Label htmlFor="new-status">New Status</Label>
            <Select value={newStatus} onValueChange={handleStatusChange}>
              <SelectTrigger id="new-status">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add a note about this status change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              These notes will be appended to the quotation's internal notes with a timestamp.
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
