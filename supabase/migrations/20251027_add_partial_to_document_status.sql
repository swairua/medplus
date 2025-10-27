-- Add 'partial' value to document_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'document_status' AND e.enumlabel = 'partial'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'partial';
  END IF;
END
$$;
