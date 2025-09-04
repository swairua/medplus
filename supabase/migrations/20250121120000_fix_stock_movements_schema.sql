-- Fix stock_movements table schema conflicts
-- Remove any existing conflicting table and recreate with proper structure

-- Drop the existing table if it exists (this will recreate properly)
DROP TABLE IF EXISTS stock_movements CASCADE;

-- Create the corrected stock_movements table
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    reference_type VARCHAR(50) CHECK (reference_type IN ('INVOICE', 'DELIVERY_NOTE', 'RESTOCK', 'ADJUSTMENT', 'CREDIT_NOTE', 'PURCHASE')),
    reference_id UUID,
    quantity DECIMAL(10,3) NOT NULL,
    cost_per_unit DECIMAL(15,2),
    notes TEXT,
    movement_date DATE DEFAULT CURRENT_DATE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE stock_movements 
ADD CONSTRAINT fk_stock_movements_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE stock_movements 
ADD CONSTRAINT fk_stock_movements_product_id 
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_stock_movements_company_id ON stock_movements(company_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_company_product_date ON stock_movements(company_id, product_id, movement_date);

-- Enable Row Level Security
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view stock movements for their company" ON stock_movements
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert stock movements for their company" ON stock_movements
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update stock movements for their company" ON stock_movements
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete stock movements for their company" ON stock_movements
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Recreate the core update_product_stock functions to ensure they work correctly
CREATE OR REPLACE FUNCTION public.update_product_stock_core(
    p_product_uuid UUID,
    p_movement_type TEXT,
    p_quantity NUMERIC
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rows_updated INTEGER := 0;
BEGIN
  p_movement_type := UPPER(p_movement_type);
  IF p_movement_type NOT IN ('IN','OUT','ADJUSTMENT') THEN
    RAISE EXCEPTION 'Invalid movement_type: %', p_movement_type;
  END IF;

  IF p_movement_type = 'IN' THEN
    UPDATE products
    SET stock_quantity = COALESCE(stock_quantity,0) + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_uuid;
  ELSIF p_movement_type = 'OUT' THEN
    UPDATE products
    SET stock_quantity = GREATEST(COALESCE(stock_quantity,0) - p_quantity, 0),
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

-- Wrapper: product_uuid, movement_type, quantity (NUMERIC)
CREATE OR REPLACE FUNCTION public.update_product_stock(
    product_uuid UUID,
    movement_type TEXT,
    quantity NUMERIC
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity);
$$;

-- Wrapper: movement_type, product_uuid, quantity (NUMERIC) - alternate order
CREATE OR REPLACE FUNCTION public.update_product_stock(
    movement_type TEXT,
    product_uuid UUID,
    quantity NUMERIC
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity);
$$;

-- Integer overloads
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_product_stock_core(UUID, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(UUID, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(TEXT, UUID, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(UUID, TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(TEXT, UUID, INTEGER) TO authenticated, anon;
