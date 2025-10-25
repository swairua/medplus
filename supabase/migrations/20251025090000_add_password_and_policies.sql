-- Add pgcrypto for bcrypt hashing
create extension if not exists pgcrypto;

-- Add password column to profiles
alter table if exists public.profiles
  add column if not exists password text;

-- Ensure emails are unique case-insensitively
create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- Hash password on insert/update using bcrypt (only if not already bcrypt hash)
create or replace function public.profiles_hash_password()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.password is not null then
    if new.password !~ '^\\$2[aby]\\$' then
      new.password := crypt(new.password, gen_salt('bf'));
    end if;
  end if;
  return new;
end;
$$;

-- Trigger for hashing
drop trigger if exists trg_profiles_hash_password on public.profiles;
create trigger trg_profiles_hash_password
before insert or update of password on public.profiles
for each row execute function public.profiles_hash_password();

-- Optional: keep profiles in sync when a user is created in auth.users
-- This makes admin-created users immediately active with metadata mirrored
-- Approach: if a profile exists for the email, attach auth_user_id; otherwise create a new profile with auth_user_id set to the auth user id.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Try to update an existing profile that matches the email (case-insensitive)
  update public.profiles p
  set
    auth_user_id = new.id,
    email = new.email,
    full_name = coalesce(coalesce(new.raw_user_meta_data->>'full_name', new.user_metadata->>'full_name'), p.full_name),
    role = coalesce(coalesce(new.raw_user_meta_data->>'role', new.user_metadata->>'role'), p.role),
    status = 'active',
    is_active = true,
    updated_at = now()
  where lower(p.email) = lower(new.email);

  if found then
    return new;
  end if;

  -- No existing profile, create a new profile record and set both id and auth_user_id to the new auth id
  insert into public.profiles (id, auth_user_id, email, full_name, role, status, is_active, created_at, updated_at)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(coalesce(new.raw_user_meta_data->>'full_name', new.user_metadata->>'full_name'), null),
    coalesce(coalesce(new.raw_user_meta_data->>'role', new.user_metadata->>'role'), 'user'),
    'active',
    true,
    now(),
    now()
  );

  return new;
end;
$$;

-- Create trigger on auth.users insert (optional)
do $$ begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_auth_user_created();
  end if;
end $$;

-- Add auth_user_id to link profiles to auth.users without changing primary id
alter table if exists public.profiles
  add column if not exists auth_user_id uuid;

-- RLS: enable on profiles
alter table public.profiles enable row level security;

-- Helper: check if current user is admin of given company
create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and p.company_id = target_company
      and p.role::text in ('admin','super_admin')
  );
$$;

-- Policies
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
for select
using (id = auth.uid() or auth_user_id = auth.uid());

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
for update
using (id = auth.uid() or auth_user_id = auth.uid())
with check (id = auth.uid() or auth_user_id = auth.uid());

-- Company admins can view all users in their company
drop policy if exists "Admins can view company users" on public.profiles;
create policy "Admins can view company users" on public.profiles
for select
using (public.is_company_admin(company_id));

-- Company admins can manage (update) users in their company
drop policy if exists "Admins can manage company users" on public.profiles;
create policy "Admins can manage company users" on public.profiles
for update
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

-- Inserts into profiles are performed by Edge Functions (service role) and bypass RLS.
