import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseErrorMessageWithCodes } from '@/utils/errorHelpers';
import { toast } from 'sonner';

export interface QuotationItem {
  quotation_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_setting_id?: string;
  tax_percentage?: number;
  tax_amount?: number;
  tax_inclusive?: boolean;
  line_total: number;
  sort_order?: number;
}

export interface InvoiceItem {
  invoice_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  discount_before_vat?: number;
  tax_setting_id?: string;
  tax_percentage?: number;
  tax_amount?: number;
  tax_inclusive?: boolean;
  line_total: number;
  sort_order?: number;
}

// Calculate line item totals with tax
export const calculateLineItemTotal = (item: {
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  tax_percentage?: number;
  tax_inclusive?: boolean;
}) => {
  const { quantity, unit_price, discount_percentage = 0, tax_percentage = 0, tax_inclusive = false } = item;
  
  const baseAmount = quantity * unit_price;
  const discountAmount = baseAmount * (discount_percentage / 100);
  const afterDiscount = baseAmount - discountAmount;
  
  let taxAmount = 0;
  let lineTotal = 0;
  
  if (tax_inclusive) {
    // Tax is already included in the unit price
    lineTotal = afterDiscount;
    taxAmount = afterDiscount - (afterDiscount / (1 + tax_percentage / 100));
  } else {
    // Tax is added on top
    taxAmount = afterDiscount * (tax_percentage / 100);
    lineTotal = afterDiscount + taxAmount;
  }
  
  return {
    line_total: lineTotal,
    tax_amount: taxAmount,
    subtotal: afterDiscount,
    discount_amount: discountAmount
  };
};

// Hook for restocking inventory
export const useRestockProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      productId, 
      quantity, 
      costPerUnit, 
      companyId, 
      supplier, 
      notes 
    }: {
      productId: string;
      quantity: number;
      costPerUnit?: number;
      companyId: string;
      supplier?: string;
      notes?: string;
    }) => {
      // Create stock movement record
      const { data: movement, error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          company_id: companyId,
          product_id: productId,
          movement_type: 'IN',
          reference_type: 'RESTOCK',
          quantity: quantity,
          cost_per_unit: costPerUnit,
          notes: notes || `Restock from ${supplier || 'supplier'}`
        }])
        .select()
        .single();
      
      if (movementError) throw movementError;
      
      // Update product stock quantity
      const { error: stockError } = await supabase.rpc('update_product_stock', {
        product_uuid: productId,
        movement_type: 'IN',
        quantity: quantity
      });
      
      if (stockError) throw stockError;
      
      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });
};

export const useCreateQuotationWithItems = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ quotation, items }: { quotation: any; items: QuotationItem[] }) => {
      // Ensure created_by references the authenticated user to satisfy FK constraints
      let cleanQuotation = { ...quotation } as any;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id || null;
        if (authUserId) {
          cleanQuotation.created_by = authUserId;
        } else if (typeof cleanQuotation.created_by === 'undefined') {
          cleanQuotation.created_by = null;
        }
      } catch {
        if (typeof cleanQuotation.created_by === 'undefined') {
          cleanQuotation.created_by = null;
        }
      }

      // First create the quotation
      let quotationDataRes;
      let quotationErrorRes;
      {
        const { data, error } = await supabase
          .from('quotations')
          .insert([cleanQuotation])
          .select()
          .single();
        quotationDataRes = data; quotationErrorRes = error as any;
      }

      // Fallback: if FK violation on created_by, retry with created_by = null
      if (quotationErrorRes && quotationErrorRes.code === '23503' && String(quotationErrorRes.message || '').includes('created_by')) {
        const retryPayload = { ...cleanQuotation, created_by: null };
        const { data: retryData, error: retryError } = await supabase
          .from('quotations')
          .insert([retryPayload])
          .select()
          .single();
        quotationDataRes = retryData; quotationErrorRes = retryError as any;
      }

      if (quotationErrorRes) throw quotationErrorRes;
      const quotationData = quotationDataRes;

      // Then create the quotation items if any
      if (items.length > 0) {
        const quotationItems = items.map((item, index) => ({
          ...item,
          quotation_id: quotationData.id,
          sort_order: index + 1
        }));
        
        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(quotationItems);
        
        if (itemsError) throw itemsError;
      }
      
      return quotationData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
};

// Convert quotation to invoice
export const useConvertQuotationToInvoice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (quotationId: string) => {
      // Get quotation data
      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          quotation_items(*)
        `)
        .eq('id', quotationId)
        .single();
      
      if (quotationError) throw quotationError;
      
      // Generate invoice number
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', {
        company_uuid: quotation.company_id
      });
      
      // Create invoice from quotation
      // Determine creator
      let createdBy: string | null = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        createdBy = userData?.user?.id || null;
      } catch {
        createdBy = null;
      }

      const invoiceData = {
        company_id: quotation.company_id,
        customer_id: quotation.customer_id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'sent',
        subtotal: quotation.subtotal,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount,
        notes: quotation.notes,
        terms_and_conditions: quotation.terms_and_conditions,
        affects_inventory: true,
        created_by: createdBy
      };

      let { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();

      // Fallback: if FK violation on created_by, retry with created_by = null
      if (invoiceError && invoiceError.code === '23503' && String(invoiceError.message || '').includes('created_by')) {
        const retryPayload = { ...invoiceData, created_by: null };
        const retryRes = await supabase
          .from('invoices')
          .insert([retryPayload])
          .select()
          .single();
        invoice = retryRes.data;
        invoiceError = retryRes.error as any;
      }

      if (invoiceError) throw invoiceError;
      
      // Create invoice items from quotation items
      if (quotation.quotation_items && quotation.quotation_items.length > 0) {
        const invoiceItems = quotation.quotation_items.map((item: any) => ({
          invoice_id: invoice.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_before_vat: item.discount_before_vat || 0,
          tax_percentage: item.tax_percentage,
          tax_amount: item.tax_amount,
          tax_inclusive: item.tax_inclusive,
          line_total: item.line_total,
          sort_order: item.sort_order
        }));
        
        let itemsError: any = null;
        {
          const res = await supabase
            .from('invoice_items')
            .insert(invoiceItems);
          itemsError = res.error as any;
        }

        // Fallback: remove discount_before_vat if schema doesn't have it
        if (itemsError && (itemsError.code === 'PGRST204' || String(itemsError.message || '').toLowerCase().includes('discount_before_vat'))) {
          const minimalItems = invoiceItems.map(({ discount_before_vat, ...rest }) => rest);
          const retry = await supabase
            .from('invoice_items')
            .insert(minimalItems);
          itemsError = retry.error as any;
        }

        if (itemsError) throw itemsError;
        
        // Create stock movements
        const stockMovements = invoiceItems
          .filter(item => item.product_id && item.quantity > 0)
          .map(item => ({
            company_id: invoice.company_id,
            product_id: item.product_id,
            movement_type: 'OUT' as const,
            reference_type: 'INVOICE' as const,
            reference_id: invoice.id,
            quantity: -item.quantity,
            cost_per_unit: item.unit_price,
            notes: `Stock reduction for invoice ${invoice.invoice_number} (converted from quotation ${quotation.quotation_number})`
          }));

        if (stockMovements.length > 0) {
          await supabase.from('stock_movements').insert(stockMovements);

          // Update product stock quantities in parallel
          const stockUpdatePromises = stockMovements.map(movement =>
            supabase.rpc('update_product_stock', {
              product_uuid: movement.product_id,
              movement_type: movement.movement_type,
              quantity: Math.abs(movement.quantity)
            })
          );

          const stockUpdateResults = await Promise.allSettled(stockUpdatePromises);

          // Log any failed stock updates
          stockUpdateResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              const msg = parseErrorMessageWithCodes(result.reason || result, 'stock update');
              console.error(`Failed to update stock for product: ${stockMovements[index].product_id} - ${msg}`, result.reason || result);
            } else if (result.value && result.value.error) {
              const msg = parseErrorMessageWithCodes(result.value.error, 'stock update');
              console.error(`Stock update error for product: ${stockMovements[index].product_id} - ${msg}`, result.value.error);
            }
          });
        }
      }
      
      // Update quotation status
      await supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id', quotationId);
      
      return invoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      toast.success(`Quotation converted to invoice ${data.invoice_number} successfully!`);
    },
    onError: (error) => {
      const errorMessage = parseErrorMessageWithCodes(error, 'convert quotation to invoice');
      console.error('Error converting quotation to invoice:', errorMessage);
      toast.error(`Error converting quotation to invoice: ${errorMessage}`);
    },
  });
};

export const useCreateInvoiceWithItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoice, items }: { invoice: any; items: InvoiceItem[] }) => {
      // Ensure created_by references the authenticated user to satisfy FK constraints
      let cleanInvoice = { ...invoice } as any;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id || null;
        if (authUserId) {
          cleanInvoice.created_by = authUserId;
        } else if (typeof cleanInvoice.created_by === 'undefined') {
          // Leave as null if no auth user available; FK allows null
          cleanInvoice.created_by = null;
        }
      } catch {
        // If auth lookup fails, don't block invoice creation
        if (typeof cleanInvoice.created_by === 'undefined') {
          cleanInvoice.created_by = null;
        }
      }

      // First create the invoice
      let invoiceDataRes;
      let invoiceErrorRes;
      {
        const { data, error } = await supabase
          .from('invoices')
          .insert([cleanInvoice])
          .select()
          .single();
        invoiceDataRes = data; invoiceErrorRes = error as any;
      }
      if (invoiceErrorRes && invoiceErrorRes.code === '23503' && String(invoiceErrorRes.message || '').includes('created_by')) {
        const retryPayload = { ...cleanInvoice, created_by: null };
        const { data: retryData, error: retryError } = await supabase
          .from('invoices')
          .insert([retryPayload])
          .select()
          .single();
        invoiceDataRes = retryData; invoiceErrorRes = retryError as any;
      }

      if (invoiceErrorRes) throw invoiceErrorRes;
      const invoiceData = invoiceDataRes;

      // Then create the invoice items if any
      if (items.length > 0) {
        const invoiceItems = items.map((item, index) => ({
          ...item,
          invoice_id: invoiceData.id,
          sort_order: index + 1
        }));

        let itemsError: any = null;
        {
          const res = await supabase
            .from('invoice_items')
            .insert(invoiceItems);
          itemsError = res.error as any;
        }

        // Fallback: remove discount_before_vat if schema doesn't have it
        if (itemsError && (itemsError.code === 'PGRST204' || String(itemsError.message || '').toLowerCase().includes('discount_before_vat'))) {
          const minimalItems = invoiceItems.map(({ discount_before_vat, ...rest }) => rest);
          const retry = await supabase
            .from('invoice_items')
            .insert(minimalItems);
          itemsError = retry.error as any;
        }

        if (itemsError) throw itemsError;

        // Create stock movements for products that affect inventory
        if (invoice.affects_inventory !== false) {
          const stockMovements = items
            .filter(item => item.product_id && item.quantity > 0)
            .map(item => ({
              company_id: invoice.company_id,
              product_id: item.product_id!,
              movement_type: 'OUT' as const,
              reference_type: 'INVOICE' as const,
              reference_id: invoiceData.id,
              quantity: item.quantity, // Positive quantity, movement_type determines direction
              cost_per_unit: item.unit_price,
              notes: `Stock reduction for invoice ${invoice.invoice_number}`
            }));

          if (stockMovements.length > 0) {
            // Use the robust stock movements creation utility
            const { createStockMovements } = await import('@/utils/initializeStockMovements');
            const { data: stockData, error: stockError } = await createStockMovements(stockMovements);

            if (stockError) {
              console.error('Failed to create stock movements:', stockError);

              // Check if this is a constraint violation error
              if (stockError.message && stockError.message.includes('check constraint violation')) {
                console.error('Stock movements constraint error detected. The database constraints may need to be fixed.');
                throw new Error('Invoice creation failed due to stock movements constraint error. Please contact your system administrator to fix the database constraints.');
              }

              // Don't throw for other errors - invoice was created successfully, stock inconsistency can be fixed later
              console.warn(`Stock movements creation failed for invoice ${invoice.invoice_number}. Invoice created successfully but inventory may not be updated.`);
            } else {
              console.log(`Created ${stockData?.length || 0} stock movements for invoice ${invoice.invoice_number}`);
            }

            // Update product stock quantities in parallel for better performance
            const stockUpdatePromises = stockMovements.map(movement =>
              supabase.rpc('update_product_stock', {
                product_uuid: movement.product_id,
                movement_type: movement.movement_type,
                quantity: Math.abs(movement.quantity) // Use absolute value since movement_type determines direction
              })
            );

            const stockUpdateResults = await Promise.allSettled(stockUpdatePromises);

            // Check for any failed stock updates
            const failedUpdates = stockUpdateResults.filter((result, index) => {
              if (result.status === 'rejected') {
                console.error('Failed to update stock for product:', stockMovements[index].product_id, result.reason);
                return true;
              }
              if (result.status === 'fulfilled' && result.value && result.value.error) {
                const msg = parseErrorMessageWithCodes(result.value.error, 'stock update');
                console.error(`Stock update error for product: ${stockMovements[index].product_id} - ${msg}`, result.value.error);
                return true;
              }
              return false;
            });

            if (failedUpdates.length > 0) {
              console.warn(`${failedUpdates.length} out of ${stockMovements.length} stock updates failed`);
              // Don't throw - invoice was created successfully, stock inconsistencies can be fixed later
            }
          }
        }
      }

      return invoiceData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });
};

export const useUpdateInvoiceWithItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, invoice, items }: { invoiceId: string; invoice: any; items: InvoiceItem[] }) => {
      // First, reverse any existing stock movements for this invoice
      const { data: existingMovements } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('reference_id', invoiceId)
        .eq('reference_type', 'INVOICE');

      if (existingMovements && existingMovements.length > 0) {
        // Create reverse movements
        const reverseMovements = existingMovements.map(movement => ({
          company_id: movement.company_id,
          product_id: movement.product_id,
          movement_type: movement.movement_type === 'OUT' ? 'IN' : 'OUT' as const,
          reference_type: 'ADJUSTMENT' as const,
          reference_id: invoiceId,
          quantity: -movement.quantity,
          notes: `Reversal for updated invoice ${invoice.invoice_number}`
        }));

        await supabase.from('stock_movements').insert(reverseMovements);

        // Update product stock quantities in parallel for reverse movements
        const reverseUpdatePromises = reverseMovements.map(movement =>
          supabase.rpc('update_product_stock', {
            product_uuid: movement.product_id,
            movement_type: movement.movement_type,
            quantity: Math.abs(movement.quantity)
          })
        );

        const reverseUpdateResults = await Promise.allSettled(reverseUpdatePromises);

        // Log any failed reverse stock updates
        reverseUpdateResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            const msg = parseErrorMessageWithCodes(result.reason || result, 'reverse stock update');
            console.error(`Failed to reverse stock for product: ${reverseMovements[index].product_id} - ${msg}`, result.reason || result);
          } else if (result.value && result.value.error) {
            const msg = parseErrorMessageWithCodes(result.value.error, 'reverse stock update');
            console.error(`Reverse stock update error for product: ${reverseMovements[index].product_id} - ${msg}`, result.value.error);
          }
        });
      }

      // Update the invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .update(invoice)
        .eq('id', invoiceId)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Delete existing invoice items
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (deleteError) throw deleteError;

      // Create new invoice items
      if (items.length > 0) {
        const invoiceItems = items.map((item, index) => ({
          ...item,
          invoice_id: invoiceId,
          sort_order: index + 1
        }));

        let itemsError: any = null;
        {
          const res = await supabase
            .from('invoice_items')
            .insert(invoiceItems);
          itemsError = res.error as any;
        }

        // Fallback: remove discount_before_vat if schema doesn't have it
        if (itemsError && (itemsError.code === 'PGRST204' || String(itemsError.message || '').toLowerCase().includes('discount_before_vat'))) {
          const minimalItems = invoiceItems.map(({ discount_before_vat, ...rest }) => rest);
          const retry = await supabase
            .from('invoice_items')
            .insert(minimalItems);
          itemsError = retry.error as any;
        }

        if (itemsError) throw itemsError;

        // Create new stock movements if affects inventory
        if (invoice.affects_inventory !== false) {
          const stockMovements = items
            .filter(item => item.product_id && item.quantity > 0)
            .map(item => ({
              company_id: invoice.company_id,
              product_id: item.product_id!,
              movement_type: 'OUT' as const,
              reference_type: 'INVOICE' as const,
              reference_id: invoiceId,
              quantity: -item.quantity,
              cost_per_unit: item.unit_price,
              notes: `Stock reduction for updated invoice ${invoice.invoice_number}`
            }));

          if (stockMovements.length > 0) {
            await supabase.from('stock_movements').insert(stockMovements);

            // Update product stock quantities in parallel for new movements
            const newStockUpdatePromises = stockMovements.map(movement =>
              supabase.rpc('update_product_stock', {
                product_uuid: movement.product_id,
                movement_type: movement.movement_type,
                quantity: Math.abs(movement.quantity)
              })
            );

            const newStockUpdateResults = await Promise.allSettled(newStockUpdatePromises);

            // Log any failed new stock updates
            newStockUpdateResults.forEach((result, index) => {
              if (result.status === 'rejected') {
                const msg = parseErrorMessageWithCodes(result.reason || result, 'stock update');
                console.error(`Failed to update stock for product: ${stockMovements[index].product_id} - ${msg}`, result.reason || result);
              } else if (result.value && result.value.error) {
                const msg = parseErrorMessageWithCodes(result.value.error, 'stock update');
                console.error(`Stock update error for product: ${stockMovements[index].product_id} - ${msg}`, result.value.error);
              }
            });
          }
        }
      }

      return invoiceData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });
};

// Create proforma invoice
export const useCreateProformaWithItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ proforma, items }: { proforma: any; items: any[] }) => {
      // Ensure created_by defaults to the authenticated user
      let cleanProforma = { ...proforma } as any;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id || null;
        if (authUserId) {
          cleanProforma.created_by = authUserId;
        } else if (typeof cleanProforma.created_by === 'undefined' || cleanProforma.created_by === null) {
          cleanProforma.created_by = null;
        }
      } catch {
        if (typeof cleanProforma.created_by === 'undefined') {
          cleanProforma.created_by = null;
        }
      }

      // First create the proforma invoice
      let proformaDataRes;
      let proformaErrorRes;
      {
        const { data, error } = await supabase
          .from('proforma_invoices')
          .insert([cleanProforma])
          .select()
          .single();
        proformaDataRes = data; proformaErrorRes = error as any;
      }
      if (proformaErrorRes && proformaErrorRes.code === '23503' && String(proformaErrorRes.message || '').includes('created_by')) {
        const retryPayload = { ...cleanProforma, created_by: null };
        const { data: retryData, error: retryError } = await supabase
          .from('proforma_invoices')
          .insert([retryPayload])
          .select()
          .single();
        proformaDataRes = retryData; proformaErrorRes = retryError as any;
      }

      if (proformaErrorRes) throw proformaErrorRes;
      const proformaData = proformaDataRes;

      // Then create the proforma items if any
      if (items.length > 0) {
        const proformaItems = items.map((item, index) => ({
          proforma_id: proformaData.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          discount_amount: item.discount_amount || 0,
          tax_percentage: item.tax_percentage || 0,
          tax_amount: item.tax_amount || 0,
          tax_inclusive: !!item.tax_inclusive,
          line_total: item.line_total,
          sort_order: index + 1
        }));

        let { error: itemsError } = await supabase
          .from('proforma_items')
          .insert(proformaItems);

        if (itemsError) {
          const msg = (itemsError.message || JSON.stringify(itemsError)).toLowerCase();
          if (msg.includes('discount_percentage')) {
            const minimalItems = proformaItems.map(({ discount_percentage, ...rest }) => rest);
            const retry = await supabase.from('proforma_items').insert(minimalItems);
            if (retry.error) throw retry.error;
          } else {
            throw itemsError;
          }
        }
      }

      return proformaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma_invoices'] });
    },
  });
};

// Create delivery note (affects inventory without creating invoice)
export const useCreateDeliveryNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ deliveryNote, items }: { deliveryNote: any; items: any[] }) => {
      // Validate that delivery note is backed by a sale (invoice)
      if (!deliveryNote.invoice_id) {
        throw new Error('Delivery note must be linked to an existing invoice or sale.');
      }

      // Verify the invoice exists and belongs to the same company
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, customer_id, company_id')
        .eq('id', deliveryNote.invoice_id)
        .eq('company_id', deliveryNote.company_id)
        .single();

      if (invoiceError || !invoice) {
        throw new Error('Related invoice not found or does not belong to this company.');
      }

      // Verify customer matches
      if (invoice.customer_id !== deliveryNote.customer_id) {
        throw new Error('Delivery note customer must match the invoice customer.');
      }

      // Verify delivery items correspond to invoice items
      if (items.length > 0) {
        const { data: invoiceItems } = await supabase
          .from('invoice_items')
          .select('product_id, quantity')
          .eq('invoice_id', deliveryNote.invoice_id);

        const invoiceProductMap = new Map();
        (invoiceItems || []).forEach((item: any) => {
          invoiceProductMap.set(item.product_id, item.quantity);
        });

        // Check that all delivery items exist in the invoice
        for (const item of items) {
          if (!invoiceProductMap.has(item.product_id)) {
            throw new Error(`Product in delivery note is not included in the related invoice.`);
          }

          const invoiceQuantity = invoiceProductMap.get(item.product_id);
          const deliveredQuantity = item.quantity_delivered ?? item.quantity ?? 0;
          const orderedQuantity = item.quantity_ordered ?? invoiceQuantity ?? item.quantity ?? 0;

          if (deliveredQuantity > invoiceQuantity) {
            throw new Error(`Delivery quantity (${deliveredQuantity}) cannot exceed invoice quantity (${invoiceQuantity}) for product.`);
          }

          if (deliveredQuantity > orderedQuantity) {
            console.warn(`Delivery quantity (${deliveredQuantity}) exceeds ordered quantity (${orderedQuantity}) for product ${item.product_id}`);
          }
        }
      }

      // Create delivery note
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_notes')
        .insert([deliveryNote])
        .select()
        .single();
      
      if (deliveryError) throw deliveryError;
      
      // Create delivery note items
      if (items.length > 0) {
        const deliveryItems = items.map((item, index) => {
          const quantityOrdered = item.quantity_ordered ?? item.quantity ?? item.quantity_delivered ?? 0;
          const quantityDelivered = item.quantity_delivered ?? item.quantity ?? 0;
          return {
            delivery_note_id: deliveryData.id,
            product_id: item.product_id,
            description: item.description,
            quantity_ordered: quantityOrdered,
            quantity_delivered: quantityDelivered,
            unit_of_measure: item.unit_of_measure ?? 'pcs',
            unit_price: item.unit_price ?? 0,
            sort_order: index + 1,
          };
        });

        const { error: itemsError } = await supabase
          .from('delivery_note_items')
          .insert(deliveryItems);

        if (itemsError) throw itemsError;

        // Create stock movements for delivered items
        const stockMovements = deliveryItems
          .filter(item => item.product_id && (item.quantity_delivered ?? 0) > 0)
          .map(item => ({
            company_id: deliveryNote.company_id,
            product_id: item.product_id,
            movement_type: 'OUT' as const,
            reference_type: 'DELIVERY_NOTE' as const,
            reference_id: deliveryData.id,
            quantity: -(item.quantity_delivered ?? 0),
            notes: `Stock delivery for delivery note ${deliveryNote.delivery_number || deliveryNote.delivery_note_number}`
          }));

        if (stockMovements.length > 0) {
          await supabase.from('stock_movements').insert(stockMovements);

          // Update product stock quantities
          for (const movement of stockMovements) {
            await supabase.rpc('update_product_stock', {
              product_uuid: movement.product_id,
              movement_type: movement.movement_type,
              quantity: Math.abs(movement.quantity)
            });
          }
        }
      }
      
      return deliveryData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_notes'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });
};

// Delete delivery note (reverses stock movements and cleans up entries)
export const useDeleteDeliveryNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliveryNoteId: string) => {
      // Check permission before deletion
      const { profile } = await (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Not authenticated');

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, permissions')
          .eq('id', user.id)
          .single();

        return { profile: profileData };
      })();

      // Check if user has delete_delivery_note permission (or admin/stock_manager)
      if (profile && profile.role !== 'admin' && profile.role !== 'stock_manager' && !profile.permissions?.includes('delete_delivery_note')) {
        throw new Error('You do not have permission to delete delivery notes');
      }

      // Fetch delivery note and its items for cleanup
      const { data: deliveryNote, error: deliveryError } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          delivery_note_items(*)
        `)
        .eq('id', deliveryNoteId)
        .single();

      if (deliveryError) throw deliveryError;
      if (!deliveryNote) throw new Error('Delivery note not found');

      // Fetch stock movements related to this delivery note
      const { data: stockMovements, error: movementsError } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('reference_id', deliveryNoteId)
        .eq('reference_type', 'DELIVERY_NOTE');

      if (movementsError) {
        console.warn('Failed to fetch stock movements for reversal:', movementsError);
      }

      // Create reverse stock movements to restore inventory
      const reverseMovements: any[] = [];
      if (stockMovements && stockMovements.length > 0) {
        for (const movement of stockMovements) {
          reverseMovements.push({
            company_id: movement.company_id,
            product_id: movement.product_id,
            movement_type: movement.movement_type === 'OUT' ? 'IN' : 'OUT',
            reference_type: 'DELIVERY_NOTE_REVERSAL',
            reference_id: deliveryNoteId,
            quantity: -movement.quantity, // Reverse the quantity
            cost_per_unit: movement.cost_per_unit,
            notes: `Reversal of delivery note ${deliveryNote.delivery_number || deliveryNote.delivery_note_number}: ${movement.notes || 'Original delivery'}`
          });
        }
      }

      // Insert reverse movements first
      if (reverseMovements.length > 0) {
        const { error: reverseError } = await supabase
          .from('stock_movements')
          .insert(reverseMovements);

        if (reverseError) {
          console.warn('Failed to create reverse stock movements:', reverseError);
        } else {
          // Update product stock quantities for each reverse movement
          for (const movement of reverseMovements) {
            try {
              await supabase.rpc('update_product_stock', {
                product_uuid: movement.product_id,
                movement_type: movement.movement_type,
                quantity: Math.abs(movement.quantity)
              });
            } catch (e) {
              console.warn(`Failed to update stock for product ${movement.product_id}:`, e);
            }
          }
        }
      }

      // Delete delivery note items (cascaded, but explicit for clarity)
      const { error: deleteItemsError } = await supabase
        .from('delivery_note_items')
        .delete()
        .eq('delivery_note_id', deliveryNoteId);

      if (deleteItemsError) {
        console.warn('Failed to delete delivery note items:', deleteItemsError);
      }

      // Delete the original stock movements
      const { error: deleteMovementsError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('reference_id', deliveryNoteId)
        .eq('reference_type', 'DELIVERY_NOTE');

      if (deleteMovementsError) {
        console.warn('Failed to delete original stock movements:', deleteMovementsError);
      }

      // Delete the delivery note
      const { error: deleteError } = await supabase
        .from('delivery_notes')
        .delete()
        .eq('id', deliveryNoteId);

      if (deleteError) {
        const errorMessage = parseErrorMessageWithCodes(deleteError, 'delete delivery note');
        console.error('Error deleting delivery note:', errorMessage);
        throw new Error(`Failed to delete delivery note: ${errorMessage}`);
      }

      return deliveryNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery_notes'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      toast.success(`Delivery note ${data.delivery_number || data.delivery_note_number} deleted successfully. Inventory has been readjusted.`);
    },
    onError: (error) => {
      const errorMessage = parseErrorMessageWithCodes(error, 'delete delivery note');
      console.error('Error deleting delivery note:', errorMessage);
      toast.error(`Failed to delete delivery note: ${errorMessage}`);
    },
  });
};

// Convert quotation to proforma invoice
export const useConvertQuotationToProforma = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quotationId: string) => {
      // Get quotation data
      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          quotation_items(*)
        `)
        .eq('id', quotationId)
        .single();

      if (quotationError) throw quotationError;

      // Generate proforma number
      const { data: proformaNumber, error: proformaNumberError } = await supabase.rpc('generate_proforma_number', {
        company_uuid: quotation.company_id
      });

      if (proformaNumberError) throw proformaNumberError;

      // Create proforma from quotation
      let createdBy: string | null = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        createdBy = userData?.user?.id || null;
      } catch {
        createdBy = null;
      }

      const validUntilDate = new Date(quotation.valid_until || Date.now() + 30 * 24 * 60 * 60 * 1000);

      const proformaData = {
        company_id: quotation.company_id,
        customer_id: quotation.customer_id,
        proforma_number: proformaNumber,
        proforma_date: new Date().toISOString().split('T')[0],
        valid_until: validUntilDate.toISOString().split('T')[0],
        status: 'draft',
        subtotal: quotation.subtotal,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount,
        notes: `Converted from quotation ${quotation.quotation_number}`,
        terms_and_conditions: quotation.terms_and_conditions,
        created_by: createdBy
      };

      let { data: proforma, error: proformaError } = await supabase
        .from('proforma_invoices')
        .insert([proformaData])
        .select()
        .single();

      // Fallback: if FK violation on created_by, retry with created_by = null
      if (proformaError && proformaError.code === '23503' && String(proformaError.message || '').includes('created_by')) {
        const retryPayload = { ...proformaData, created_by: null };
        const retryRes = await supabase
          .from('proforma_invoices')
          .insert([retryPayload])
          .select()
          .single();
        proforma = retryRes.data;
        proformaError = retryRes.error as any;
      }

      if (proformaError) throw proformaError;

      // Create proforma items from quotation items
      if (quotation.quotation_items && quotation.quotation_items.length > 0) {
        const proformaItems = quotation.quotation_items.map((item: any) => ({
          proforma_id: proforma.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage || 0,
          tax_percentage: item.tax_percentage,
          tax_amount: item.tax_amount,
          tax_inclusive: item.tax_inclusive,
          line_total: item.line_total,
          sort_order: item.sort_order
        }));

        let { error: itemsError } = await supabase
          .from('proforma_items')
          .insert(proformaItems);

        if (itemsError) {
          const msg = (itemsError.message || JSON.stringify(itemsError)).toLowerCase();
          if (msg.includes('discount_percentage')) {
            const minimalItems = proformaItems.map(({ discount_percentage, ...rest }) => rest);
            const retry = await supabase.from('proforma_items').insert(minimalItems);
            if (retry.error) throw retry.error;
          } else {
            throw itemsError;
          }
        }
      }

      // Update quotation status
      await supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id', quotationId);

      return proforma;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['proforma_invoices'] });
      toast.success(`Quotation converted to proforma invoice ${data.proforma_number} successfully!`);
    },
    onError: (error) => {
      const errorMessage = parseErrorMessageWithCodes(error, 'convert quotation to proforma');
      console.error('Error converting quotation to proforma:', errorMessage);
      toast.error(`Error converting quotation to proforma: ${errorMessage}`);
    },
  });
};

// Delete a quotation (audited, cleans up items)
export const useDeleteQuotation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quotationId: string) => {
      // Check permission before deletion
      const { profile } = await (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Not authenticated');

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, permissions')
          .eq('id', user.id)
          .single();

        return { profile: profileData };
      })();

      // Check if user has delete_quotation permission
      if (profile && !profile.permissions?.includes('delete_quotation')) {
        throw new Error('You do not have permission to delete quotations');
      }

      // Fetch snapshot for audit
      let snapshot: any = null;
      let companyId: string | null = null;
      try {
        const { data, error } = await supabase
          .from('quotations')
          .select(`*, quotation_items(*)`)
          .eq('id', quotationId)
          .single();
        if (!error) {
          snapshot = data;
          companyId = (data as any)?.company_id ?? null;
        }
      } catch {}

      // Attempt to log deletion (best-effort)
      try {
        const { logDeletion } = await import('@/utils/auditLogger');
        await logDeletion('quotation', quotationId, snapshot, companyId);
      } catch (e) {
        console.warn('Quotation delete audit failed:', (e as any)?.message || e);
      }

      // Attempt to delete child items first (best-effort)
      try {
        await supabase.from('quotation_items').delete().eq('quotation_id', quotationId);
      } catch (e) {
        console.warn('Quotation items delete skipped/failed:', (e as any)?.message || e);
      }

      // Delete parent record
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', quotationId);

      if (error) {
        const errorMessage = parseErrorMessageWithCodes(error, 'delete quotation');
        console.error('Error deleting quotation:', errorMessage);
        throw new Error(`Failed to delete quotation: ${errorMessage}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation deleted successfully!');
    },
    onError: (error) => {
      const errorMessage = parseErrorMessageWithCodes(error, 'delete quotation');
      console.error('Error deleting quotation:', errorMessage);
      toast.error(`Failed to delete quotation: ${errorMessage}`);
    },
  });
};

// Update quotation status
export const useUpdateQuotationStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quotationId, status, notes }: { quotationId: string; status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'; notes?: string }) => {
      const updateData: any = { status };

      if (notes) {
        // Append note to existing notes
        const { data: currentQuotation } = await supabase
          .from('quotations')
          .select('notes')
          .eq('id', quotationId)
          .single();

        if (currentQuotation?.notes) {
          updateData.notes = `${currentQuotation.notes}\n[${new Date().toLocaleString()}] Status changed to ${status}: ${notes}`;
        } else {
          updateData.notes = `[${new Date().toLocaleString()}] Status changed to ${status}: ${notes}`;
        }
      }

      const { data, error } = await supabase
        .from('quotations')
        .update(updateData)
        .eq('id', quotationId)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });

      const statusLabels: Record<string, string> = {
        'draft': 'Draft',
        'sent': 'Sent',
        'accepted': 'Accepted',
        'rejected': 'Rejected',
        'expired': 'Expired',
        'converted': 'Converted',
      };

      toast.success(`Quotation status changed to ${statusLabels[variables.status] || variables.status}`);
    },
    onError: (error) => {
      const errorMessage = parseErrorMessageWithCodes(error, 'update quotation status');
      console.error('Error updating quotation status:', errorMessage);
      toast.error(`Failed to update status: ${errorMessage}`);
    },
  });
};
