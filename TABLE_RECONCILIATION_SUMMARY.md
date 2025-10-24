# Table Reconciliation: Users → Profiles Migration

## Overview
Successfully consolidated the dual user management system by migrating from a legacy `users` table to the `profiles` table as the single source of truth for user data and audit trails.

## Problem Statement
The application had two conflicting user management approaches:
- **Profiles Table**: Rich schema with auth integration (used by UserManagement UI)
- **Users Table**: Simple self-managed table (referenced by domain tables for `created_by` auditing)

This dual approach caused:
- Inconsistent user data between tables
- Potential FK violations when `created_by` references didn't match profiles
- Admin users couldn't effectively manage users from a single interface

## Solution (Option A)
Consolidated all user-related functionality to use the `profiles` table exclusively.

## Changes Made

### 1. Database Migrations

#### Created: `supabase/migrations/20250122000000_consolidate_users_to_profiles.sql`
- Adds `is_active` column to profiles (for backward compatibility)
- Migrates any existing user data from `users` table to `profiles`
- Performs role enum mapping:
  - `manager` → `accountant`
  - `sales` → `user`
  - `viewer` → `user`
  - `admin` stays `admin`
- Updates all 7 foreign key references from `users(id)` to `profiles(id)`
- Drops the legacy `users` table
- Creates audit trail in `migration_logs` table

### 2. Schema Updates

Updated all `created_by` foreign key references across these tables:

| Table | Change |
|-------|--------|
| quotations | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |
| invoices | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |
| proforma_invoices | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |
| delivery_notes | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |
| payments | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |
| remittance_advice | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |
| stock_movements | FK: `users(id)` → `profiles(id)` with `ON DELETE SET NULL` |

**Files Updated:**
- `database-schema.sql`: Removed users table definition, updated all 7 table FK constraints
- `fix-invoice-columns.sql`: Updated invoices FK reference

### 3. SQL Migrations Updated

- `supabase/migrations/20241221100001_create_lpo_tables.sql`
  - Updated LPO table `created_by` FK: `users(id)` → `profiles(id)`

- `supabase/migrations/20250121000000_create_stock_movements_table.sql`
  - Updated conditional FK constraint check: `users` → `profiles`

### 4. TypeScript Code Updates

**File: `src/hooks/useDatabase.ts`** (lines 1703-1729)
- Changed user existence validation from `users` table to `profiles` table
- Updated FK validation logic for LPO creation
- Changed console messages to reference `profiles` instead of `users`

**File: `src/utils/setupLPOTables.ts`**
- Updated LPO table creation SQL to use `profiles` FK

## User Management Flow (No Changes Required)

The UserManagement UI already uses the correct table:

```typescript
// src/hooks/useUserManagement.ts
const fetchUsers = async () => {
  const query = supabase
    .from('profiles')  // ✅ Already correct
    .select('*')
    .order('created_at', { ascending: false });
  // ...
};
```

**Supported Roles:** admin, accountant, stock_manager, user

## Migration Steps

### For Administrators:

1. **Backup Database** (recommended)
   ```bash
   # Create backup before migration
   ```

2. **Apply Migration**
   - The new migration file will execute automatically when deployed
   - Existing user data is preserved and mapped appropriately
   - The `users` table is dropped after migration

3. **Verify Results**
   - Check `migration_logs` table for successful completion
   - Verify user counts in `profiles` table
   - Test admin user creation/management in UI

### For Developers:

1. **No Code Changes Required** - All application code already expects profiles table
2. **Update Local Database** - Run migrations against your local Supabase instance
3. **Test User Operations**
   - Create new user
   - Edit user role/status
   - Delete user
   - Generate documents (quotations, invoices, etc.) and verify `created_by` is populated

## Backward Compatibility

- **Data Preservation**: All user data is migrated and preserved
- **Role Mapping**: Legacy roles are automatically converted to new enum values
- **Audit Trail**: Document creation timestamps and attribution remain intact
- **RLS Policies**: Existing Row-Level Security policies on profiles table remain functional

## Rollback Plan (if needed)

If issues occur, you can:
1. Restore from database backup
2. The new migration is idempotent - rerunning won't cause issues
3. The migration logs table maintains audit trail

## Benefits

✅ **Single Source of Truth**: Users managed entirely through profiles table
✅ **Simplified Admin Interface**: One place to create/manage all users
✅ **Better Data Consistency**: No duplicate user data across tables
✅ **Improved FK Integrity**: All document audit trails use consistent user references
✅ **Cleaner Schema**: Removed redundant self-managed users table
✅ **Future-Proof**: Aligned with Supabase auth best practices

## Testing Checklist

- [ ] Database migration applies without errors
- [ ] Existing users visible in UserManagement page
- [ ] Admin can create new users
- [ ] Admin can edit user roles and details
- [ ] Admin can delete users
- [ ] New documents (invoices, quotations) have correct `created_by`
- [ ] Historical documents retain their `created_by` values
- [ ] User invitations still work correctly
- [ ] Role-based access control functions as expected

## Related Files

- Migration: `supabase/migrations/20250122000000_consolidate_users_to_profiles.sql`
- Schema: `database-schema.sql`
- Hook: `src/hooks/useUserManagement.ts`
- Auth Context: `src/contexts/AuthContext.tsx`
