-- Add a global sequence and trigger to assign customer_number and customer_code
-- Run this migration on your Postgres/Supabase database.

BEGIN;

-- Create a sequence for customer numbers (global sequence)
CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1;

-- Add columns if they don't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number BIGINT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);

-- Set default to nextval for customer_number
ALTER TABLE customers ALTER COLUMN customer_number SET DEFAULT nextval('customer_number_seq');

-- Populate existing rows without customer_number
UPDATE customers SET customer_number = nextval('customer_number_seq') WHERE customer_number IS NULL;

-- Function to set customer_code based on customer_number
CREATE OR REPLACE FUNCTION set_customer_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := nextval('customer_number_seq');
  END IF;
  -- Format customer_code as CUST followed by zero-padded 6-digit number
  NEW.customer_code := 'CUST' || to_char(NEW.customer_number, 'FM000000');
  RETURN NEW;
END;
$$;

-- Create trigger to set code before insert or update
DROP TRIGGER IF EXISTS trg_set_customer_code ON customers;
CREATE TRIGGER trg_set_customer_code
BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_customer_code();

-- Add uniqueness constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_customer_code'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT unique_customer_code UNIQUE (customer_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_company_customer_number'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT unique_company_customer_number UNIQUE (company_id, customer_number);
  END IF;
END$$;

COMMIT;
