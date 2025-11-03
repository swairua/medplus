import { supabase } from '@/integrations/supabase/client';

/**
 * Automated setup for payment-invoice synchronization
 * Creates the database function that handles payment recording with automatic invoice updates
 */
export async function setupPaymentSync(): Promise<{ success: boolean; message: string; details?: any }> {
  return {
    success: false,
    message: 'Automatic database function creation is not available in this environment. Please use the manual setup guide to create the function in your Supabase dashboard.',
    details: {
      error: 'Client-side SQL execution not supported',
      suggestion: 'Use the Payment Allocation Status card to access the manual setup guide with the SQL code'
    }
  };
}

/**
 * Test if payment sync is already set up
 */
export async function testPaymentSync(): Promise<{ isSetup: boolean; message: string }> {
  try {
    const { error } = await supabase.rpc('record_payment_with_allocation', {
      p_company_id: '00000000-0000-0000-0000-000000000000',
      p_customer_id: '00000000-0000-0000-0000-000000000000',
      p_invoice_id: '00000000-0000-0000-0000-000000000000',
      p_payment_number: 'TEST',
      p_payment_date: '2024-01-01',
      p_amount: 1,
      p_payment_method: 'cash',
      p_reference_number: 'TEST',
      p_notes: 'Test'
    });

    if (error && error.message?.includes('function record_payment_with_allocation')) {
      return {
        isSetup: false,
        message: 'Payment sync function not found - setup required'
      };
    }

    return {
      isSetup: true,
      message: 'Payment sync system is already configured'
    };
  } catch (error: any) {
    let errorMessage = 'Unknown error';

    if (error && typeof error === 'object') {
      if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      } else if (error.code) {
        errorMessage = `Database error (${error.code})`;
      } else {
        errorMessage = JSON.stringify(error);
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return {
      isSetup: false,
      message: `Unable to test payment sync: ${errorMessage}`
    };
  }
}
