-- Create audit_logs table for tracking system events
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    record_id UUID,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_email TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for audit_logs table
-- Users can view audit logs for their company
CREATE POLICY "Users can view audit logs for their company" ON audit_logs
    FOR SELECT USING (
        company_id IS NULL OR
        company_id = (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Only authenticated users can insert audit logs (through backend functions)
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can update/delete audit logs
CREATE POLICY "Admins can update audit logs" ON audit_logs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles admin_profile
            WHERE admin_profile.id = auth.uid()
            AND admin_profile.role = 'admin'
            AND (audit_logs.company_id IS NULL OR admin_profile.company_id = audit_logs.company_id)
        )
    );

CREATE POLICY "Admins can delete audit logs" ON audit_logs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles admin_profile
            WHERE admin_profile.id = auth.uid()
            AND admin_profile.role = 'admin'
            AND (audit_logs.company_id IS NULL OR admin_profile.company_id = audit_logs.company_id)
        )
    );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_audit_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_audit_logs_updated_at BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION update_audit_logs_updated_at();

-- Create function to log user creation
CREATE OR REPLACE FUNCTION log_user_creation(
    p_invited_email TEXT,
    p_invited_role TEXT,
    p_company_id UUID
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        action,
        entity_type,
        company_id,
        actor_user_id,
        actor_email,
        details
    ) VALUES (
        'CREATE',
        'user_creation',
        p_company_id,
        auth.uid(),
        (SELECT email FROM profiles WHERE id = auth.uid()),
        jsonb_build_object(
            'invited_email', p_invited_email,
            'invited_role', p_invited_role
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log user approval
CREATE OR REPLACE FUNCTION log_user_approval(
    p_user_id UUID,
    p_approval_status TEXT,
    p_company_id UUID
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        action,
        entity_type,
        record_id,
        company_id,
        actor_user_id,
        actor_email,
        details
    ) VALUES (
        'APPROVE',
        'user_approval',
        p_user_id,
        p_company_id,
        auth.uid(),
        (SELECT email FROM profiles WHERE id = auth.uid()),
        jsonb_build_object(
            'user_email', (SELECT email FROM profiles WHERE id = p_user_id),
            'approval_status', p_approval_status
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log user invitation
CREATE OR REPLACE FUNCTION log_user_invitation(
    p_invited_email TEXT,
    p_invited_role TEXT,
    p_company_id UUID
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        action,
        entity_type,
        company_id,
        actor_user_id,
        actor_email,
        details
    ) VALUES (
        'INVITE',
        'user_invitation',
        p_company_id,
        auth.uid(),
        (SELECT email FROM profiles WHERE id = auth.uid()),
        jsonb_build_object(
            'invited_email', p_invited_email,
            'invited_role', p_invited_role
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
