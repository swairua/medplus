import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useConvertQuotationToProforma } from '@/hooks/useQuotationItems';
import { Loader2, ArrowRight } from 'lucide-react';

interface ConvertQuotationToProformaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationNumber: string;
  quotationId: string;
  onSuccess?: (proformaNumber: string) => void;
}

export function ConvertQuotationToProformaModal({
  open,
  onOpenChange,
  quotationNumber,
  quotationId,
  onSuccess
}: ConvertQuotationToProformaModalProps) {
  const convertToProforma = useConvertQuotationToProforma();
  const isLoading = convertToProforma.isPending;

  const handleConfirm = async () => {
    try {
      const result = await convertToProforma.mutateAsync(quotationId);
      onOpenChange(false);
      onSuccess?.(result.proforma_number);
    } catch (error) {
      console.error('Conversion failed:', error);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Convert to Proforma Invoice
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will convert quotation <strong>{quotationNumber}</strong> to a proforma invoice.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">This action will:</p>
              <ul className="list-disc list-inside text-blue-800 dark:text-blue-200">
                <li>Create a new proforma invoice with status "Draft"</li>
                <li>Generate a proforma number</li>
                <li>Copy all items and amounts from the quotation</li>
                <li>Mark the quotation as "Converted"</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. The quotation will be locked from further editing.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Converting...' : 'Convert to Proforma'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
