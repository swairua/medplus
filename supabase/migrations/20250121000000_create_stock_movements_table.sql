-- Create stock_movements table for inventory tracking
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    movement_type VARCHAR(50) NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT'
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(15,2),
    reference_type VARCHAR(50), -- 'INVOICE', 'DELIVERY_NOTE', 'CREDIT_NOTE', 'ADJUSTMENT', 'PURCHASE'
    reference_id UUID,
    reference_number VARCHAR(255),
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints if the referenced tables exist
DO $$
BEGIN
    -- Add company_id foreign key if companies table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        ALTER TABLE stock_movements 
        ADD CONSTRAINT fk_stock_movements_company_id 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;

    -- Add product_id foreign key if products table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE stock_movements 
        ADD CONSTRAINT fk_stock_movements_product_id 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;

    -- Add created_by foreign key if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE stock_movements 
        ADD CONSTRAINT fk_stock_movements_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_product_date ON stock_movements(company_id, product_id, movement_date);

-- Enable Row Level Security
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic company-based access)
CREATE POLICY "Users can view stock movements for their company" ON stock_movements
    FOR SELECT USING (
        company_id IN (
            SELECT id FROM companies 
            WHERE id = company_id -- Replace with proper user-company relationship when auth is implemented
        )
    );

CREATE POLICY "Users can insert stock movements for their company" ON stock_movements
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT id FROM companies 
            WHERE id = company_id -- Replace with proper user-company relationship when auth is implemented
        )
    );

CREATE POLICY "Users can update stock movements for their company" ON stock_movements
    FOR UPDATE USING (
        company_id IN (
            SELECT id FROM companies 
            WHERE id = company_id -- Replace with proper user-company relationship when auth is implemented
        )
    );

CREATE POLICY "Users can delete stock movements for their company" ON stock_movements
    FOR DELETE USING (
        company_id IN (
            SELECT id FROM companies 
            WHERE id = company_id -- Replace with proper user-company relationship when auth is implemented
        )
    );

-- Create core stock update function and useful wrappers to accommodate different RPC call signatures
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

  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must be non-negative: %', p_quantity;
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

CREATE OR REPLACE FUNCTION public.update_product_stock(
  product_uuid UUID,
  movement_type TEXT,
  quantity NUMERIC
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity);
$$;

CREATE OR REPLACE FUNCTION public.update_product_stock(
  movement_type TEXT,
  product_uuid UUID,
  quantity NUMERIC
) RETURNS JSON LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT public.update_product_stock_core(product_uuid, movement_type, quantity);
$$;

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

-- Grant execute perms
GRANT EXECUTE ON FUNCTION public.update_product_stock_core(UUID, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(UUID, TEXT, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(TEXT, UUID, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(UUID, TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock(TEXT, UUID, INTEGER) TO authenticated, anon;
