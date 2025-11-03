import { supabase } from '@/integrations/supabase/client';

export interface ReconciliationResult {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  calculatedPaidAmount: number;
  storedPaidAmount: number;
  calculatedBalance: number;
  storedBalance: number;
  discrepancy: number;
  status: 'matched' | 'mismatched';
  expectedStatus: string;
  actualStatus: string;
  fixed: boolean;
  error?: string;
}

/**
 * Reconcile invoice balance with payment allocations
 * Detects and optionally fixes discrepancies
 */
export async function reconcileInvoiceBalance(
  invoiceId: string,
  fix: boolean = false
): Promise<ReconciliationResult> {
  try {
    // 1. Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, paid_amount, balance_due, status')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('Invoice not found');

    // 2. Get all allocations for this invoice
    const { data: allocations, error: allocationsError } = await supabase
      .from('payment_allocations')
      .select('amount_allocated')
      .eq('invoice_id', invoiceId);

    if (allocationsError) throw allocationsError;

    // 3. Calculate values
    const calculatedPaidAmount = (allocations || []).reduce(
      (sum, alloc) => sum + (alloc.amount_allocated || 0),
      0
    );
    const calculatedBalance = invoice.total_amount - calculatedPaidAmount;

    // 4. Determine expected status
    let expectedStatus = 'draft';
    if (calculatedBalance <= 0 && calculatedPaidAmount > 0) {
      expectedStatus = 'paid';
    } else if (calculatedPaidAmount > 0) {
      expectedStatus = 'partial';
    }

    // 5. Check for discrepancies
    const paidAmountDiscrepancy = Math.abs((invoice.paid_amount || 0) - calculatedPaidAmount);
    const balanceDiscrepancy = Math.abs((invoice.balance_due || 0) - calculatedBalance);
    const statusMismatch = invoice.status !== expectedStatus;
    const hasDiscrepancy = paidAmountDiscrepancy > 0.01 || balanceDiscrepancy > 0.01 || statusMismatch;

    const result: ReconciliationResult = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      totalAmount: invoice.total_amount,
      calculatedPaidAmount,
      storedPaidAmount: invoice.paid_amount || 0,
      calculatedBalance,
      storedBalance: invoice.balance_due || 0,
      discrepancy: Math.max(paidAmountDiscrepancy, balanceDiscrepancy),
      status: hasDiscrepancy ? 'mismatched' : 'matched',
      expectedStatus,
      actualStatus: invoice.status,
      fixed: false
    };

    // 6. Fix if requested and needed
    if (fix && hasDiscrepancy) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: calculatedPaidAmount,
          balance_due: calculatedBalance,
          status: expectedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (updateError) {
        result.error = updateError.message;
        result.fixed = false;
      } else {
        result.fixed = true;
      }
    }

    return result;
  } catch (error: any) {
    throw new Error(`Failed to reconcile invoice ${invoiceId}: ${error.message}`);
  }
}

/**
 * Reconcile all invoices in a company
 * Returns summary of reconciliation results
 */
export async function reconcileAllInvoiceBalances(
  companyId: string,
  fix: boolean = false
): Promise<{
  total: number;
  matched: number;
  mismatched: number;
  fixed: number;
  results: ReconciliationResult[];
  errors: string[];
}> {
  try {
    // 1. Get all invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (invoicesError) throw invoicesError;

    const results: ReconciliationResult[] = [];
    const errors: string[] = [];

    // 2. Reconcile each invoice
    for (const invoice of invoices || []) {
      try {
        const result = await reconcileInvoiceBalance(invoice.id, fix);
        results.push(result);
      } catch (error: any) {
        errors.push(`Invoice ${invoice.id}: ${error.message}`);
      }
    }

    // 3. Summary
    const summary = {
      total: results.length,
      matched: results.filter(r => r.status === 'matched').length,
      mismatched: results.filter(r => r.status === 'mismatched').length,
      fixed: results.filter(r => r.fixed).length,
      results,
      errors
    };

    return summary;
  } catch (error: any) {
    throw new Error(`Failed to reconcile invoices: ${error.message}`);
  }
}

/**
 * Audit trail: Get payment history for an invoice
 */
export async function getPaymentAuditTrail(invoiceId: string): Promise<any[]> {
  try {
    // Get allocations with payment details
    const { data, error } = await supabase
      .from('payment_allocations')
      .select(`
        id,
        amount_allocated,
        created_at,
        payments (
          id,
          payment_number,
          amount,
          payment_method,
          payment_date,
          reference_number,
          created_by,
          created_at,
          profiles:created_by (
            email,
            full_name
          )
        )
      `)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(allocation => ({
      id: allocation.id,
      paymentNumber: allocation.payments?.payment_number,
      paymentAmount: allocation.payments?.amount,
      allocatedAmount: allocation.amount_allocated,
      paymentMethod: allocation.payments?.payment_method,
      paymentDate: allocation.payments?.payment_date,
      referenceNumber: allocation.payments?.reference_number,
      createdBy: allocation.payments?.profiles?.full_name || allocation.payments?.profiles?.email,
      createdAt: allocation.created_at
    }));
  } catch (error: any) {
    console.error('Failed to get payment audit trail:', error);
    return [];
  }
}

/**
 * Check if an invoice has payment discrepancies
 */
export async function hasBalanceDiscrepancy(invoiceId: string): Promise<boolean> {
  try {
    const result = await reconcileInvoiceBalance(invoiceId, false);
    return result.status === 'mismatched';
  } catch (error) {
    console.error('Failed to check balance discrepancy:', error);
    return false;
  }
}
