import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CreditNote {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_id?: string;
  credit_note_number: string;
  credit_note_date: string;
  status: 'draft' | 'sent' | 'applied' | 'cancelled';
  reason?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  applied_amount: number;
  balance: number;
  affects_inventory: boolean;
  notes?: string;
  terms_and_conditions?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  customers?: {
    name: string;
    email?: string;
    phone?: string;
    customer_code: string;
  };
  credit_note_items?: CreditNoteItem[];
  invoices?: {
    invoice_number: string;
    total_amount: number;
  };
}

export interface CreditNoteItem {
  id: string;
  credit_note_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  tax_inclusive: boolean;
  tax_setting_id?: string;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  products?: {
    name: string;
    product_code: string;
    unit_of_measure: string;
  };
}

export interface CreditNoteAllocation {
  id: string;
  credit_note_id: string;
  invoice_id: string;
  allocated_amount: number;
  allocation_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// Fetch all credit notes for a company
export function useCreditNotes(companyId: string | undefined) {
  return useQuery({
    queryKey: ['creditNotes', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID is required');

      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          customers!customer_id (
            name,
            email,
            phone,
            customer_code
          ),
          credit_note_items (
            *,
            products!product_id (
              name,
              product_code,
              unit_of_measure
            )
          ),
          invoices!invoice_id (
            invoice_number,
            total_amount
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditNote[];
    },
    enabled: !!companyId,
  });
}

// Fetch credit notes for a specific customer
export function useCustomerCreditNotes(customerId: string | undefined, companyId: string | undefined) {
  return useQuery({
    queryKey: ['customerCreditNotes', customerId, companyId],
    queryFn: async () => {
      if (!customerId || !companyId) throw new Error('Customer ID and Company ID are required');

      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          customers!customer_id (
            name,
            email,
            phone,
            customer_code
          ),
          credit_note_items (
            *,
            products!product_id (
              name,
              product_code,
              unit_of_measure
            )
          )
        `)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditNote[];
    },
    enabled: !!customerId && !!companyId,
  });
}

// Fetch a single credit note by ID
export function useCreditNote(creditNoteId: string | undefined) {
  return useQuery({
    queryKey: ['creditNote', creditNoteId],
    queryFn: async () => {
      if (!creditNoteId) throw new Error('Credit Note ID is required');

      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          customers!customer_id (
            name,
            email,
            phone,
            customer_code
          ),
          credit_note_items (
            *,
            products!product_id (
              name,
              product_code,
              unit_of_measure
            )
          ),
          invoices!invoice_id (
            invoice_number,
            total_amount
          )
        `)
        .eq('id', creditNoteId)
        .single();

      if (error) throw error;
      return data as CreditNote;
    },
    enabled: !!creditNoteId,
  });
}

// Create a new credit note
export function useCreateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (creditNote: Omit<CreditNote, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('credit_notes')
        .insert(creditNote)
        .select()
        .single();

      if (error) throw error;
      return data as CreditNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['customerCreditNotes'] });
      toast.success(`Credit note ${data.credit_note_number} created successfully!`);
    },
    onError: (error: any) => {
      console.error('Error creating credit note:', error);
      toast.error('Failed to create credit note. Please try again.');
    },
  });
}

// Update an existing credit note
export function useUpdateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreditNote> }) => {
      const { data, error } = await supabase
        .from('credit_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CreditNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['creditNote', data.id] });
      queryClient.invalidateQueries({ queryKey: ['customerCreditNotes'] });
      toast.success(`Credit note ${data.credit_note_number} updated successfully!`);
    },
    onError: (error: any) => {
      console.error('Error updating credit note:', error);
      toast.error('Failed to update credit note. Please try again.');
    },
  });
}

// Delete a credit note
export function useDeleteCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Check permission before deletion
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Not authenticated');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

      if (!profileData) throw new Error('User profile not found');

      const { data: roleData } = await supabase
        .from('roles')
        .select('permissions')
        .eq('company_id', profileData.company_id)
        .eq('name', profileData.role)
        .single();

      if (!roleData?.permissions?.includes('delete_credit_note')) {
        throw new Error('You do not have permission to delete credit notes');
      }

      // 1. Fetch the complete credit note with all related data
      const { data: creditNote, error: fetchError } = await supabase
        .from('credit_notes')
        .select(
          `
          *,
          credit_note_items(*),
          credit_note_allocations(*)
        `
        )
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!creditNote) throw new Error('Credit note not found');

      // 2. If credit note affects inventory, reverse stock movements
      let stockMovementsReversedCount = 0;
      if (creditNote.affects_inventory) {
        const { data: stockMovements, error: stockError } = await supabase
          .from('stock_movements')
          .select('*')
          .eq('reference_type', 'CREDIT_NOTE')
          .eq('reference_id', id);

        if (stockError && !stockError.message.includes('does not exist')) {
          throw stockError;
        }

        if (stockMovements && stockMovements.length > 0) {
          const reversals = stockMovements.map((movement) => ({
            company_id: movement.company_id,
            product_id: movement.product_id,
            movement_type: movement.movement_type === 'IN' ? 'OUT' : 'IN',
            reference_type: 'CREDIT_NOTE_REVERSAL',
            reference_id: id,
            quantity: movement.quantity,
            cost_per_unit: movement.cost_per_unit,
            notes: `Reversal of CREDIT_NOTE ${creditNote.credit_note_number}: ${movement.notes || ''}`,
          }));

          const { error: reversalError } = await supabase
            .from('stock_movements')
            .insert(reversals);

          if (reversalError && !reversalError.message.includes('does not exist')) {
            throw reversalError;
          }

          stockMovementsReversedCount = stockMovements.length;
        }
      }

      // 3. If there are allocations, update related invoices
      if (creditNote.credit_note_allocations && creditNote.credit_note_allocations.length > 0) {
        for (const allocation of creditNote.credit_note_allocations) {
          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select('balance_due, paid_amount, total_amount')
            .eq('id', allocation.invoice_id)
            .single();

          if (!invoiceError && invoice) {
            // Recalculate balance_due by adding back the allocated amount
            const newBalanceDue = (invoice.balance_due || 0) + allocation.allocated_amount;

            await supabase
              .from('invoices')
              .update({ balance_due: newBalanceDue })
              .eq('id', allocation.invoice_id);
          }
        }
      }

      // 4. Delete the credit note (cascade deletes items and allocations)
      const { error: deleteError } = await supabase
        .from('credit_notes')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // 5. Log the deletion with full snapshot
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id || null;
        const userEmail = (data?.user?.email as string) || null;

        await supabase.from('audit_logs').insert([
          {
            action: 'DELETE',
            entity_type: 'credit_note',
            record_id: id,
            company_id: creditNote.company_id,
            actor_user_id: userId,
            actor_email: userEmail,
            details: {
              credit_note_number: creditNote.credit_note_number,
              customer_id: creditNote.customer_id,
              total_amount: creditNote.total_amount,
              applied_amount: creditNote.applied_amount,
              items_count: creditNote.credit_note_items?.length || 0,
              allocations_count: creditNote.credit_note_allocations?.length || 0,
              affected_invoices: creditNote.credit_note_allocations?.map((a) => a.invoice_id) || [],
              inventory_affected: creditNote.affects_inventory,
              stock_movements_reversed: stockMovementsReversedCount,
            },
          },
        ]);
      } catch (auditError) {
        console.warn('Audit log creation failed:', auditError);
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['customerCreditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Credit note deleted successfully! All related records have been updated.');
    },
    onError: (error: any) => {
      console.error('Error deleting credit note:', error);
      const errorMessage =
        error.message || 'Failed to delete credit note. Please try again.';
      toast.error(errorMessage);
    },
  });
}

// Generate credit note number
export function useGenerateCreditNoteNumber() {
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase
        .rpc('generate_credit_note_number', { company_uuid: companyId });

      if (error) throw error;
      return data as string;
    },
    onError: (error: any) => {
      console.error('Error generating credit note number:', error);
      toast.error('Failed to generate credit note number. Please try again.');
    },
  });
}

// Fetch credit note allocations
export function useCreditNoteAllocations(creditNoteId: string | undefined) {
  return useQuery({
    queryKey: ['creditNoteAllocations', creditNoteId],
    queryFn: async () => {
      if (!creditNoteId) throw new Error('Credit Note ID is required');

      const { data, error } = await supabase
        .from('credit_note_allocations')
        .select(`
          *,
          invoices!invoice_id (
            invoice_number,
            total_amount,
            balance_due
          )
        `)
        .eq('credit_note_id', creditNoteId)
        .order('allocation_date', { ascending: false });

      if (error) throw error;
      return data as (CreditNoteAllocation & {
        invoices: {
          invoice_number: string;
          total_amount: number;
          balance_due: number;
        };
      })[];
    },
    enabled: !!creditNoteId,
  });
}

// Apply credit note to invoice
export function useApplyCreditNoteToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      creditNoteId,
      invoiceId,
      amount,
      appliedBy
    }: {
      creditNoteId: string;
      invoiceId: string;
      amount: number;
      appliedBy: string;
    }) => {
      const { data, error } = await supabase
        .rpc('apply_credit_note_to_invoice', {
          credit_note_uuid: creditNoteId,
          invoice_uuid: invoiceId,
          amount_to_apply: amount,
          applied_by_uuid: appliedBy
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['creditNoteAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Credit note applied to invoice successfully!');
    },
    onError: (error: any) => {
      console.error('Error applying credit note:', error);
      const errorMessage = error.message || 'Failed to apply credit note to invoice';
      toast.error(errorMessage);
    },
  });
}
