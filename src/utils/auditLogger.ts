import { supabase } from '@/integrations/supabase/client';
import { executeSQL } from '@/utils/execSQL';

export type AuditedEntity = 'quotation' | 'proforma' | 'invoice' | 'credit_note' | 'user_invitation' | 'user_creation';

interface AuditLogEntry {
  action: 'DELETE' | 'CREATE' | 'APPROVE' | 'INVITE';
  entity_type: AuditedEntity;
  record_id: string | null;
  company_id?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  details?: any; // JSON snapshot
}

async function tableExists(table: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error && (error.message?.includes('does not exist') || error.code === 'PGRST116')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function ensureAuditLogSchema(): Promise<void> {
  const exists = await tableExists('audit_logs');
  if (exists) return;

  const sql = `
  create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    action text not null,
    entity_type text not null,
    record_id uuid,
    company_id uuid,
    actor_user_id uuid,
    actor_email text,
    details jsonb
  );
  create index if not exists idx_audit_logs_entity on audit_logs(entity_type, record_id);
  create index if not exists idx_audit_logs_company on audit_logs(company_id);
  create index if not exists idx_audit_logs_action on audit_logs(action);
  `;

  await executeSQL(sql);
}

async function getActorInfo(): Promise<{ user_id: string | null; email: string | null }> {
  let actor_user_id: string | null = null;
  let actor_email: string | null = null;

  try {
    const { data } = await supabase.auth.getUser();
    actor_user_id = data?.user?.id ?? null;
    actor_email = (data?.user?.email as string) ?? null;
  } catch {
    // ignore
  }

  return { user_id: actor_user_id, email: actor_email };
}

async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  const insertAttempt = await supabase.from('audit_logs' as any).insert([entry]);

  if (insertAttempt.error) {
    // Try once more after ensuring schema
    try {
      await ensureAuditLogSchema();
      const retry = await supabase.from('audit_logs' as any).insert([entry]);
      if (retry.error) {
        // Swallow to not block operations; surface in console for diagnostics
        // eslint-disable-next-line no-console
        console.warn('Audit log insert failed:', retry.error?.message || retry.error);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('Audit log ensure+insert failed:', e?.message || e);
    }
  }
}

export async function logDeletion(
  entity: AuditedEntity,
  recordId: string | null,
  snapshot?: any,
  companyId?: string | null
): Promise<void> {
  // Ensure table exists (best-effort)
  try {
    await ensureAuditLogSchema();
  } catch {
    // ignore, we'll still try insert which will fail if table truly missing
  }

  const { user_id: actor_user_id, email: actor_email } = await getActorInfo();

  const entry: AuditLogEntry = {
    action: 'DELETE',
    entity_type: entity,
    record_id: recordId ?? null,
    company_id: companyId ?? null,
    actor_user_id,
    actor_email,
    details: snapshot ?? null,
  };

  await insertAuditLog(entry);
}

export async function logUserCreation(
  invitationId: string,
  email: string,
  role: string,
  companyId: string
): Promise<void> {
  // Ensure table exists (best-effort)
  try {
    await ensureAuditLogSchema();
  } catch {
    // ignore
  }

  const { user_id: actor_user_id, email: actor_email } = await getActorInfo();

  const entry: AuditLogEntry = {
    action: 'CREATE',
    entity_type: 'user_creation',
    record_id: invitationId,
    company_id: companyId,
    actor_user_id,
    actor_email,
    details: {
      invited_email: email,
      invited_role: role,
      timestamp: new Date().toISOString(),
    },
  };

  await insertAuditLog(entry);
}

export async function logUserApproval(
  invitationId: string,
  email: string,
  companyId: string,
  approvalStatus: string
): Promise<void> {
  // Ensure table exists (best-effort)
  try {
    await ensureAuditLogSchema();
  } catch {
    // ignore
  }

  const { user_id: actor_user_id, email: actor_email } = await getActorInfo();

  const entry: AuditLogEntry = {
    action: 'APPROVE',
    entity_type: 'user_invitation',
    record_id: invitationId,
    company_id: companyId,
    actor_user_id,
    actor_email,
    details: {
      user_email: email,
      approval_status: approvalStatus,
      timestamp: new Date().toISOString(),
    },
  };

  await insertAuditLog(entry);
}
