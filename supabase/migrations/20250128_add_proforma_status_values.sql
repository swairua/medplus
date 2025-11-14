-- Migration: Add missing status values to document_status enum
-- Purpose: Fix "invalid input value for" error when changing proforma status
-- These values are used by the app but were missing from the enum:
--   - 'accepted' (proforma accepted by customer)
--   - 'expired' (proforma validity expired)
--   - 'converted' (proforma converted to invoice)

DO $$
BEGIN
  -- Add 'accepted' if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'document_status' AND e.enumlabel = 'accepted'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'accepted';
  END IF;

  -- Add 'expired' if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'document_status' AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'expired';
  END IF;

  -- Add 'converted' if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'document_status' AND e.enumlabel = 'converted'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'converted';
  END IF;

  -- Add 'rejected' if it doesn't exist (for quotations/proforma rejection)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'document_status' AND e.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'rejected';
  END IF;

  -- Add 'partial' if it doesn't exist (for partial payments)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'document_status' AND e.enumlabel = 'partial'
  ) THEN
    ALTER TYPE document_status ADD VALUE 'partial' BEFORE 'paid';
  END IF;

END $$;
