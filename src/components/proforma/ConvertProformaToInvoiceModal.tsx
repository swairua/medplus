import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useConvertProformaToInvoice } from '@/hooks/useProforma';
import { Loader2, ArrowRight } from 'lucide-react';

interface ConvertProformaToInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proformaNumber: string;
  proformaId: string;
  onSuccess?: (invoiceNumber: string) => void;
}

export function ConvertProformaToInvoiceModal({
  open,
  onOpenChange,
  proformaNumber,
  proformaId,
  onSuccess
}: ConvertProformaToInvoiceModalProps) {
  const convertToInvoice = useConvertProformaToInvoice();
  const isLoading = convertToInvoice.isPending;

  const handleConfirm = async () => {
    try {
      const result = await convertToInvoice.mutateAsync(proformaId);
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
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>
                This will convert proforma invoice <strong>{proformaNumber}</strong> to a regular invoice.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">This action will:</p>
                <ul className="list-disc list-inside text-blue-800 dark:text-blue-200">
                  <li>Create a new invoice with status "Sent"</li>
                  <li>Generate an invoice number</li>
                  <li>Copy all items and amounts from the proforma</li>
                  <li>Create stock movements for inventory tracking</li>
                  <li>Mark the proforma as "Converted"</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. The proforma will be locked from further editing.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3">
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Converting...' : 'Convert to Invoice'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
