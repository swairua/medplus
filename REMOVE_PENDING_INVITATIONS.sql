-- REMOVE_PENDING_INVITATIONS.sql
-- Permanently delete all pending invitations and optional placeholder profiles
-- WARNING: destructive. Please backup before running.

BEGIN;

-- Create an archive table (if not exists) to save deleted records for audit
CREATE TABLE IF NOT EXISTS user_invitations_archive (LIKE user_invitations INCLUDING ALL);

-- Insert pending invitations into archive for recovery if needed
INSERT INTO user_invitations_archive
SELECT *, now() as archived_at
FROM user_invitations
WHERE status = 'pending';

-- Show how many were archived (client will receive this result)
SELECT count(*) AS archived_pending_invitations FROM user_invitations_archive
WHERE archived_at IS NOT NULL AND status = 'pending';

-- Delete pending invitations
DELETE FROM user_invitations
WHERE status = 'pending';

-- Optionally remove placeholder profiles created for invitations
-- These placeholder profiles typically have status = 'invited'
-- and may have been created with a non-UUID id matching an invitation token.
-- This will remove profiles with status 'invited' that match archived invitation emails.

DELETE FROM profiles
WHERE status = 'invited'
  AND email IN (
    SELECT email FROM user_invitations_archive WHERE status = 'pending'
  );

-- Show counts after deletion
SELECT
  (SELECT count(*) FROM user_invitations) AS remaining_invitations,
  (SELECT count(*) FROM profiles WHERE status = 'invited') AS remaining_placeholder_profiles;

COMMIT;

-- To rollback instead of commit, run: ROLLBACK;
-- Run this using psql, supabase db execute --file REMOVE_PENDING_INVITATIONS.sql, or from Supabase SQL editor.
