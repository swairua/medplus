-- Add sent_at and send_error columns to user_invitations for email sending status

alter table if exists public.user_invitations
  add column if not exists sent_at timestamptz,
  add column if not exists send_error text;

-- Optional index to find unsent invitations quickly
create index if not exists idx_user_invitations_sent_at on public.user_invitations (sent_at);
create index if not exists idx_user_invitations_status_sent on public.user_invitations (status, sent_at);

-- Backfill: mark invitations with sent_at null and expired as expired
update public.user_invitations
set status = 'expired'
where expires_at < now() and status = 'pending' and sent_at is null;
