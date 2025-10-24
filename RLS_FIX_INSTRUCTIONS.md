# Fix: Infinite Recursion in Profiles RLS Policies

## Problem

You're seeing this error:
```
Failed to load user profile: infinite recursion detected in policy for relation "profiles"
```

This happens because the Row Level Security (RLS) policies on the `profiles` table contain self-referential queries. When Postgres tries to evaluate a policy that queries the `profiles` table, it must recursively apply RLS policies to that query, creating infinite recursion.

### Root Cause

The problematic policies look like:
```sql
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile  -- ← Self-referential!
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );
```

When Postgres evaluates the inner `SELECT FROM profiles`, it applies the same RLS policies, which then need to evaluate the inner query again → infinite recursion.

## Solution

Replace self-referential queries with **SECURITY DEFINER functions** that bypass RLS evaluation.

### Step-by-Step Fix

#### Option 1: Via Supabase Dashboard (Recommended - Easy)

1. **Go to your Supabase project**
   - Navigate to SQL Editor
   - Click "New Query"

2. **Copy and execute the SQL**
   - Open: `FIX_RLS_INFINITE_RECURSION.sql`
   - Copy all the SQL code
   - Paste into the SQL Editor
   - Click "Run"

3. **Verify the fix**
   - Run the verification queries at the bottom of the SQL file
   - You should see the policies listed without errors

4. **Try logging in**
   - Refresh the login page
   - Attempt to sign in as admin@medplus.app

#### Option 2: Via SQL Command Line

```bash
# Connect to your Supabase database
psql "postgresql://[user]:[password]@[host]:5432/postgres"

# Run the fix SQL
\i FIX_RLS_INFINITE_RECURSION.sql
```

#### Option 3: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Run migrations
supabase db execute --file FIX_RLS_INFINITE_RECURSION.sql
```

### What the Fix Does

1. **Drops** problematic self-referential policies
2. **Creates** two SECURITY DEFINER functions:
   - `is_admin(user_id, optional_company_id)` - Checks if user is admin
   - These functions bypass RLS and can safely query the profiles table
3. **Recreates** policies using the safe functions instead of subqueries

### Key Change

**Before (Broken):**
```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles  -- RLS applies here → recursion
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
```

**After (Fixed):**
```sql
USING (is_admin(auth.uid()))  -- Function call, no recursion
```

## Verification

After running the SQL, check that:

1. **Policies exist** (run in SQL Editor):
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
```
Should list:
- Users can view their own profile
- Users can update their own profile
- Admins can view all profiles in their company
- Admins can insert new profiles
- Admins can update profiles in their company
- Public can view profiles that created documents

2. **Function exists**:
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'is_admin';
```
Should show `prosecdef = true` (SECURITY DEFINER)

3. **Test login**:
- Refresh your browser
- Try logging in as admin@medplus.app

## If Something Goes Wrong

If you get an error while executing the SQL:

### Error: "Table profiles doesn't exist"
- The profiles table might not be created yet
- Run your database migrations first
- Then run this fix SQL

### Error: "Function is_admin already exists"
- The function already exists (might be from a previous attempt)
- The SQL includes `CREATE OR REPLACE FUNCTION`, so it will replace it
- This is safe and expected

### Error: "Cannot DROP POLICY"
- One or more policies don't exist
- The SQL includes `DROP POLICY IF EXISTS`, so it's safe to ignore
- Continue with the execution

### Still getting recursion error after the fix
- Clear your browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- If still broken, check that the SQL executed without errors

## Additional Notes

- The fix only affects RLS policies - no data is modified
- You can rollback by restoring from a backup if needed
- SECURITY DEFINER functions are a Postgres best practice for this use case
- The functions are owned by the postgres superuser and run with elevated privileges

## Questions?

If you encounter issues:
1. Check the "Technical Details" section in the error boundary (click "Show Diagnostics")
2. Review the verification queries above
3. Ensure all migrations have run successfully
