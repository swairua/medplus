-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    icon_name VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_id ON payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);

-- Insert default payment methods for existing companies
INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'Cash', 'cash', 'DollarSign', 1, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'Bank Transfer', 'bank_transfer', 'CreditCard', 2, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'M-Pesa', 'mobile_money', 'DollarSign', 3, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'EFT', 'eft', 'CreditCard', 4, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'RTGS', 'rtgs', 'CreditCard', 5, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'Cheque', 'cheque', 'Receipt', 6, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;
