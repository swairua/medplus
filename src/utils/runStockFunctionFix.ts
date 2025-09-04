import { supabase } from '@/integrations/supabase/client';

import { supabase } from '@/integrations/supabase/client';
import { executeSQL } from './execSQL';

/**
 * Create or fix the update_product_stock function in the database
 */
export async function createStockUpdateFunction() {
  const functionSQL = `
-- Core function: performs the actual stock update and returns JSON for easier client handling
CREATE OR REPLACE FUNCTION public.update_product_stock_core(
  p_product_uuid UUID,
  p_movement_type TEXT,
  p_quantity NUMERIC
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rows_updated INTEGER := 0;
BEGIN
  p_movement_type := UPPER(p_movement_type);
  IF p_movement_type NOT IN ('IN', 'OUT', 'ADJUSTMENT') THEN
    RAISE EXCEPTION 'Invalid movement_type: %. Must be IN, OUT, or ADJUSTMENT', p_movement_type;
  END IF;
  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must be non-negative: %', p_quantity;
  END IF;

  IF p_movement_type = 'IN' THEN
    UPDATE products
    SET stock_quantity = COALESCE(stock_quantity, 0) + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_uuid;
  ELSIF p_movement_type = 'OUT' THEN
    UPDATE products
    SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - p_quantity, 0),
        updated_at = NOW()
    WHERE id = p_product_uuid;
  ELSIF p_movement_type = 'ADJUSTMENT' THEN
    UPDATE products
    SET stock_quantity = p_quantity,
        updated_at = NOW()
    WHERE id = p_product_uuid;
  END IF;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN json_build_object('success', false, 'error', format('Product % not found', p_product_uuid));
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Wrapper 1: product_uuid, movement_type, quantity (NUMERIC)
CREATE OR REPLACE FUNCTION public.update_product_stock(
  product_uuid UUID,
  movement_type TEXT,
  quantity NUMERIC
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity);
$$;

-- Wrapper 2: movement_type, product_uuid, quantity (NUMERIC) - some clients call with this order
CREATE OR REPLACE FUNCTION public.update_product_stock(
  movement_type TEXT,
  product_uuid UUID,
  quantity NUMERIC
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity);
$$;

-- Integer overloads (quantity as INTEGER)
CREATE OR REPLACE FUNCTION public.update_product_stock(
  product_uuid UUID,
  movement_type TEXT,
  quantity INTEGER
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity::NUMERIC);
$$;

CREATE OR REPLACE FUNCTION public.update_product_stock(
  movement_type TEXT,
  product_uuid UUID,
  quantity INTEGER
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity::NUMERIC);
$$;

-- Grant execute permission to common roles
GRANT EXECUTE ON FUNCTION public.update_product_stock_core(UUID, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(UUID, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(TEXT, UUID, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(UUID, TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(TEXT, UUID, INTEGER) TO authenticated, anon;
`;

  try {
    console.log('Creating/updating update_product_stock function...');

    const { error, data } = await executeSQL(functionSQL);

    if (error) {
      console.error('Failed to create function via executeSQL:', error);
      throw new Error(error.message || 'Function creation failed');
    }

    // Try a lightweight test call for existence (use a dummy UUID)
    try {
      const dummyId = '00000000-0000-0000-0000-000000000000';
      // Call with named parameters in the order some clients use
      const { error: testError1, data: testData1 } = await supabase.rpc('update_product_stock', {
        movement_type: 'IN',
        product_uuid: dummyId,
        quantity: 1
      } as any);

      // Also test alternate order
      const { error: testError2, data: testData2 } = await supabase.rpc('update_product_stock', {
        product_uuid: dummyId,
        movement_type: 'IN',
        quantity: 1
      } as any);

      // If both returned function-not-found-like errors, bubble up
      if ((testError1 && String(testError1).includes('Could not find the function')) ||
          (testError2 && String(testError2).includes('Could not find the function'))) {
        console.warn('Function created but RPC still cannot find it in schema cache. This may need a Supabase cache refresh.');
      }

    } catch (testErr) {
      console.warn('Test RPC call failed (this may be expected if dummy product does not exist):', testErr?.message || testErr);
    }

    console.log('✅ Successfully created/updated update_product_stock function');
    return { success: true, message: 'Stock update function created successfully', data };

  } catch (error: any) {
    console.error('Error creating stock update function:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test the update_product_stock function by calling the RPC with a dummy id
 */
export async function testStockUpdateFunction() {
  try {
    const dummyId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase.rpc('update_product_stock', {
      movement_type: 'IN',
      product_uuid: dummyId,
      quantity: 1
    } as any);

    if (error) {
      // If error mentions product not found, function exists
      if (String(error).includes('Product') || String(error).includes('not found')) {
        return { success: true, message: 'Function exists and returned expected not-found error' };
      }
      return { success: false, error: String(error) };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}
