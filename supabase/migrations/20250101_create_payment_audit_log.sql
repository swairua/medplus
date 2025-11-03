-- Create payment_audit_log table for tracking payment changes
-- This audit log records all payment creation and deletion events for compliance and reconciliation

CREATE TABLE IF NOT EXISTS payment_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(50) NOT NULL, -- 'create', 'delete', 'update'
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    old_paid_amount DECIMAL(15,2),
    new_paid_amount DECIMAL(15,2),
    old_balance_due DECIMAL(15,2),
    new_balance_due DECIMAL(15,2),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    payment_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(255),
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_payment_id ON payment_audit_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_invoice_id ON payment_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_performed_by ON payment_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_action ON payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_created_at ON payment_audit_log(created_at);

-- Enable RLS on payment_audit_log
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view audit logs for invoices their company manages
CREATE POLICY "payment_audit_log_read_policy" ON payment_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_audit_log.invoice_id
        AND i.company_id = (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    )
  );

-- RLS Policy: Users can insert audit logs for their company
CREATE POLICY "payment_audit_log_insert_policy" ON payment_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_audit_log.invoice_id
        AND i.company_id = (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    )
  );

-- Create trigger function to auto-log payment creation
CREATE OR REPLACE FUNCTION log_payment_creation()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice RECORD;
    v_user_id UUID;
BEGIN
    -- Get user ID from request context
    v_user_id := auth.uid();
    
    -- Try to get invoice data from payment_allocations
    SELECT i.id, i.invoice_number, i.paid_amount, i.balance_due, i.status
    INTO v_invoice
    FROM invoices i
    WHERE i.id IN (
        SELECT DISTINCT invoice_id FROM payment_allocations 
        WHERE payment_id = NEW.id
    )
    LIMIT 1;
    
    -- If we found an invoice, log the creation
    IF v_invoice.id IS NOT NULL THEN
        INSERT INTO payment_audit_log (
            action,
            payment_id,
            invoice_id,
            new_paid_amount,
            new_balance_due,
            new_status,
            payment_amount,
            payment_method,
            reference_number,
            performed_by,
            notes
        ) VALUES (
            'create',
            NEW.id,
            v_invoice.id,
            v_invoice.paid_amount,
            v_invoice.balance_due,
            v_invoice.status,
            NEW.amount,
            NEW.payment_method,
            NEW.reference_number,
            v_user_id,
            'Payment created'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_log_payment_creation ON payments;

-- Create trigger for payment creation logging
CREATE TRIGGER trigger_log_payment_creation
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION log_payment_creation();

-- Function to get payment audit log for an invoice
CREATE OR REPLACE FUNCTION get_payment_audit_log(p_invoice_id UUID)
RETURNS TABLE (
    id UUID,
    action VARCHAR,
    payment_id UUID,
    payment_amount DECIMAL,
    payment_method VARCHAR,
    reference_number VARCHAR,
    old_paid_amount DECIMAL,
    new_paid_amount DECIMAL,
    old_balance_due DECIMAL,
    new_balance_due DECIMAL,
    old_status VARCHAR,
    new_status VARCHAR,
    performed_by_email VARCHAR,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pal.id,
        pal.action,
        pal.payment_id,
        pal.payment_amount,
        pal.payment_method,
        pal.reference_number,
        pal.old_paid_amount,
        pal.new_paid_amount,
        pal.old_balance_due,
        pal.new_balance_due,
        pal.old_status,
        pal.new_status,
        p.email as performed_by_email,
        pal.created_at
    FROM payment_audit_log pal
    LEFT JOIN profiles p ON pal.performed_by = p.id
    WHERE pal.invoice_id = p_invoice_id
    ORDER BY pal.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
