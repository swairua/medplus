import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reconcileInvoiceBalance,
  reconcileAllInvoiceBalances,
  getPaymentAuditTrail,
  hasBalanceDiscrepancy,
  type ReconciliationResult
} from '@/utils/balanceReconciliation';

/**
 * Hook to reconcile a single invoice balance
 */
export function useReconcileInvoiceBalance(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-reconciliation', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      return await reconcileInvoiceBalance(invoiceId, false);
    },
    enabled: !!invoiceId,
  });
}

/**
 * Hook to check if an invoice has balance discrepancies
 */
export function useCheckBalanceDiscrepancy(invoiceId?: string) {
  return useQuery({
    queryKey: ['balance-discrepancy', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return false;
      return await hasBalanceDiscrepancy(invoiceId);
    },
    enabled: !!invoiceId,
  });
}

/**
 * Hook to get payment audit trail for an invoice
 */
export function usePaymentAuditTrail(invoiceId?: string) {
  return useQuery({
    queryKey: ['payment-audit-trail', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      return await getPaymentAuditTrail(invoiceId);
    },
    enabled: !!invoiceId,
  });
}

/**
 * Hook to fix invoice balance discrepancy
 */
export function useFixBalanceDiscrepancy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      return await reconcileInvoiceBalance(invoiceId, true);
    },
    onSuccess: (result) => {
      // Invalidate invoice-related queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['balance-discrepancy'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

/**
 * Hook to reconcile all invoices in a company
 */
export function useReconcileAllInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      fix = false
    }: {
      companyId: string;
      fix?: boolean;
    }) => {
      return await reconcileAllInvoiceBalances(companyId, fix);
    },
    onSuccess: () => {
      // Invalidate all invoice-related queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['balance-discrepancy'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
