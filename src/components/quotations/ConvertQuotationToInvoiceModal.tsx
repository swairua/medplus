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
import { useConvertQuotationToInvoice } from '@/hooks/useQuotationItems';
import { Loader2, ArrowRight } from 'lucide-react';

interface ConvertQuotationToInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationNumber: string;
  quotationId: string;
  onSuccess?: (invoiceNumber: string) => void;
}

export function ConvertQuotationToInvoiceModal({
  open,
  onOpenChange,
  quotationNumber,
  quotationId,
  onSuccess
}: ConvertQuotationToInvoiceModalProps) {
  const convertToInvoice = useConvertQuotationToInvoice();
  const isLoading = convertToInvoice.isPending;

  const handleConfirm = async () => {
    try {
      const result = await convertToInvoice.mutateAsync(quotationId);
      onSuccess?.(result.invoice_number);
      onOpenChange(false);
    } catch (error) {
      console.error('Conversion failed:', error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Convert to Invoice
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will convert quotation <strong>{quotationNumber}</strong> directly to an invoice.
            </p>
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded text-sm space-y-1">
              <p className="font-medium text-green-900 dark:text-green-100">This action will:</p>
              <ul className="list-disc list-inside text-green-800 dark:text-green-200">
                <li>Create a new invoice with status "Sent"</li>
                <li>Generate an invoice number</li>
                <li>Copy all items and amounts from the quotation</li>
                <li>Create stock movements for inventory tracking</li>
                <li>Mark the quotation as "Converted"</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. The quotation will be locked from further editing.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3">
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Converting...' : 'Convert to Invoice'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
