-- Add approval tracking to user_invitations table
-- Allows admins to manually approve invitations before users can accept them

ALTER TABLE user_invitations
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster approval status queries
CREATE INDEX IF NOT EXISTS idx_user_invitations_approval_status ON user_invitations(is_approved, status);

-- Update RLS policy to allow admins to approve invitations
-- (Existing policy "Admins can manage invitations for their company" already covers this)

-- Add comment for documentation
COMMENT ON COLUMN user_invitations.is_approved IS 'Whether admin has manually approved this invitation';
COMMENT ON COLUMN user_invitations.approved_by IS 'Admin user who approved this invitation';
COMMENT ON COLUMN user_invitations.approved_at IS 'Timestamp when invitation was approved by admin';
