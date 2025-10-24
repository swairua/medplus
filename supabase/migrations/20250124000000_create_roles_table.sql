-- Create roles table for storing role definitions with permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    role_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    description TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, company_id),
    CONSTRAINT valid_role_type CHECK (role_type IN ('admin', 'accountant', 'stock_manager', 'user', 'custom'))
);

-- Create index for better query performance
CREATE INDEX idx_roles_company_id ON roles(company_id);
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_role_type ON roles(role_type);

-- Enable Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Create policies for roles table
CREATE POLICY "Users can view roles in their company" ON roles
    FOR SELECT USING (
        company_id IS NULL OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.company_id = roles.company_id
        )
    );

CREATE POLICY "Only admins can manage roles" ON roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles admin_profile 
            WHERE admin_profile.id = auth.uid() 
            AND admin_profile.role = 'admin'
            AND (roles.company_id IS NULL OR admin_profile.company_id = roles.company_id)
        )
    );

-- Create function to update roles updated_at
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for roles updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_roles_updated_at();

-- Insert default roles with permissions
-- Get the first company ID (or use NULL for system-wide roles)
DO $$
DECLARE
    company_id_val UUID;
BEGIN
    -- Get first company ID if it exists, otherwise use NULL
    SELECT id INTO company_id_val FROM companies LIMIT 1;
    
    -- Insert Admin role
    INSERT INTO roles (name, role_type, description, company_id, permissions, is_default)
    VALUES (
        'Admin',
        'admin',
        'Full system access with all permissions',
        company_id_val,
        ARRAY[
            'create_quotation', 'view_quotation', 'edit_quotation', 'delete_quotation', 'export_quotation',
            'create_invoice', 'view_invoice', 'edit_invoice', 'delete_invoice', 'export_invoice',
            'create_credit_note', 'view_credit_note', 'edit_credit_note', 'delete_credit_note', 'export_credit_note',
            'create_proforma', 'view_proforma', 'edit_proforma', 'delete_proforma', 'export_proforma',
            'create_payment', 'view_payment', 'edit_payment', 'delete_payment',
            'create_inventory', 'view_inventory', 'edit_inventory', 'delete_inventory', 'manage_inventory',
            'view_reports', 'export_reports', 'view_customer_reports', 'view_inventory_reports', 'view_sales_reports',
            'create_customer', 'view_customer', 'edit_customer', 'delete_customer',
            'create_delivery_note', 'view_delivery_note', 'edit_delivery_note', 'delete_delivery_note',
            'create_lpo', 'view_lpo', 'edit_lpo', 'delete_lpo',
            'create_remittance', 'view_remittance', 'edit_remittance', 'delete_remittance',
            'create_user', 'edit_user', 'delete_user', 'manage_users', 'approve_users', 'invite_users',
            'view_audit_logs', 'manage_roles', 'manage_permissions', 'access_settings'
        ],
        TRUE
    ) ON CONFLICT (name, company_id) DO NOTHING;
    
    -- Insert Accountant role
    INSERT INTO roles (name, role_type, description, company_id, permissions, is_default)
    VALUES (
        'Accountant',
        'accountant',
        'Financial and reporting permissions',
        company_id_val,
        ARRAY[
            'create_quotation', 'view_quotation', 'edit_quotation', 'export_quotation',
            'create_invoice', 'view_invoice', 'edit_invoice', 'export_invoice',
            'create_credit_note', 'view_credit_note', 'edit_credit_note', 'export_credit_note',
            'create_proforma', 'view_proforma', 'edit_proforma', 'export_proforma',
            'create_payment', 'view_payment', 'edit_payment',
            'view_inventory',
            'view_reports', 'export_reports', 'view_customer_reports', 'view_sales_reports',
            'view_customer', 'view_delivery_note',
            'view_lpo', 'view_remittance', 'create_remittance', 'view_audit_logs'
        ],
        TRUE
    ) ON CONFLICT (name, company_id) DO NOTHING;
    
    -- Insert Stock Manager role
    INSERT INTO roles (name, role_type, description, company_id, permissions, is_default)
    VALUES (
        'Stock Manager',
        'stock_manager',
        'Inventory and stock management permissions',
        company_id_val,
        ARRAY[
            'create_quotation', 'view_quotation', 'edit_quotation',
            'view_invoice', 'view_credit_note',
            'view_proforma', 'create_proforma',
            'create_inventory', 'view_inventory', 'edit_inventory', 'manage_inventory',
            'view_reports', 'view_inventory_reports',
            'view_customer', 'create_delivery_note', 'view_delivery_note', 'edit_delivery_note',
            'view_lpo', 'view_payment'
        ],
        TRUE
    ) ON CONFLICT (name, company_id) DO NOTHING;
    
    -- Insert Basic User role
    INSERT INTO roles (name, role_type, description, company_id, permissions, is_default)
    VALUES (
        'User',
        'user',
        'Limited viewing and creation permissions',
        company_id_val,
        ARRAY[
            'create_quotation', 'view_quotation', 'edit_quotation',
            'view_invoice', 'view_credit_note', 'view_proforma',
            'view_inventory',
            'view_reports', 'view_customer_reports', 'view_sales_reports',
            'view_customer', 'view_delivery_note',
            'view_lpo', 'view_payment'
        ],
        TRUE
    ) ON CONFLICT (name, company_id) DO NOTHING;
END $$;
