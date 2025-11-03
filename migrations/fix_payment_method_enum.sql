-- Fix payment_method ENUM issue by changing to VARCHAR
-- This allows payment_method to accept any code from the payment_methods table

-- First, update the setupDatabase.ts SQL to use VARCHAR instead of ENUM
-- This migration changes the payments table to accept any payment method code

-- Drop the existing payment_method ENUM type if it exists (we'll use VARCHAR instead)
-- Note: We need to alter the payments table to change the column type

-- Step 1: Create a backup of the current enum type values
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        -- Convert the ENUM to VARCHAR by:
        -- 1. Adding a new VARCHAR column
        -- 2. Copying data from the ENUM column
        -- 3. Dropping the old column
        -- 4. Renaming the new column
        
        ALTER TABLE payments ADD COLUMN payment_method_temp VARCHAR(50);
        UPDATE payments SET payment_method_temp = payment_method::text;
        ALTER TABLE payments DROP COLUMN payment_method;
        ALTER TABLE payments RENAME COLUMN payment_method_temp TO payment_method;
        ALTER TABLE payments ALTER COLUMN payment_method SET NOT NULL;
        
        -- Drop the enum type if nothing else uses it
        DROP TYPE IF EXISTS payment_method CASCADE;
    END IF;
END $$;

-- Add a constraint to ensure payment_method is not null
ALTER TABLE payments ADD CONSTRAINT payment_method_not_null CHECK (payment_method IS NOT NULL);

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);

-- Add a foreign key reference to payment_methods.code (optional but recommended)
-- Uncomment the line below if you want to enforce referential integrity
-- ALTER TABLE payments ADD CONSTRAINT fk_payment_method 
-- FOREIGN KEY (company_id, payment_method) REFERENCES payment_methods(company_id, code);

COMMIT;
