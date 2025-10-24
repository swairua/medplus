-- Consolidate users table into profiles table
-- This migration migrates all user data from the legacy 'users' table to 'profiles'
-- and updates all foreign key references in domain tables

-- Step 1: Add missing columns to profiles if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Step 2: Migrate data from users to profiles (if users table exists and has data)
-- First, ensure all users from the users table exist in profiles
INSERT INTO profiles (id, email, full_name, role, status, company_id, last_login, created_at, updated_at, is_active)
SELECT 
    u.id,
    u.email,
    u.full_name,
    CASE 
        WHEN u.role = 'manager' THEN 'accountant'::user_role
        WHEN u.role = 'sales' THEN 'user'::user_role
        WHEN u.role = 'viewer' THEN 'user'::user_role
        ELSE u.role::user_role
    END as role,
    CASE WHEN u.is_active THEN 'active'::user_status ELSE 'inactive'::user_status END as status,
    u.company_id,
    u.last_login,
    u.created_at,
    u.updated_at,
    u.is_active
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Update all foreign key references from users(id) to profiles(id)
-- Update quotations table
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_created_by_fkey;
ALTER TABLE quotations ADD CONSTRAINT quotations_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update invoices table
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update proforma_invoices table
ALTER TABLE proforma_invoices DROP CONSTRAINT IF EXISTS proforma_invoices_created_by_fkey;
ALTER TABLE proforma_invoices ADD CONSTRAINT proforma_invoices_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update delivery_notes table
ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_created_by_fkey;
ALTER TABLE delivery_notes ADD CONSTRAINT delivery_notes_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update payments table
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_created_by_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update remittance_advice table
ALTER TABLE remittance_advice DROP CONSTRAINT IF EXISTS remittance_advice_created_by_fkey;
ALTER TABLE remittance_advice ADD CONSTRAINT remittance_advice_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update stock_movements table
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Step 4: Drop the legacy users table (after all data is migrated and references updated)
DROP TABLE IF EXISTS users CASCADE;

-- Step 5: Update profiles RLS policies to support the created_by audit use case
-- Allow reading profiles that created documents (via created_by FK)
CREATE POLICY "Public can view profiles that created documents" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM quotations WHERE quotations.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM invoices WHERE invoices.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM proforma_invoices WHERE proforma_invoices.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM delivery_notes WHERE delivery_notes.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM payments WHERE payments.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM remittance_advice WHERE remittance_advice.created_by = profiles.id
            UNION ALL
            SELECT 1 FROM stock_movements WHERE stock_movements.created_by = profiles.id
        )
    );

-- Step 6: Create audit log for this migration
CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'completed',
    notes TEXT
);

INSERT INTO migration_logs (migration_name, notes)
VALUES (
    'consolidate_users_to_profiles',
    'Migrated users table to profiles. Updated 7 domain tables FK references. Dropped users table.'
);
