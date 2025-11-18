-- Fix delivery_number unique constraint
-- Change from UNIQUE to UNIQUE(company_id, delivery_number) to allow same delivery_number in different companies

BEGIN;

-- Drop the old unique constraint
ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_delivery_number_key;

-- Add the new composite unique constraint
ALTER TABLE delivery_notes ADD CONSTRAINT delivery_notes_company_id_delivery_number_key UNIQUE(company_id, delivery_number);

COMMIT;
