# Payment Methods Table Setup

## Issue
The error "Error fetching payment methods: [object Object]" occurs because the `payment_methods` table hasn't been created in your Supabase database yet.

## Solution

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Run the Migration SQL

Copy the SQL below and paste it into the SQL Editor, then click **Run**:

```sql
-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    icon_name VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_id ON payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);

-- Insert default payment methods for existing companies
INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'Cash', 'cash', 'DollarSign', 1, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'Bank Transfer', 'bank_transfer', 'CreditCard', 2, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'M-Pesa', 'mobile_money', 'DollarSign', 3, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'EFT', 'eft', 'CreditCard', 4, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'RTGS', 'rtgs', 'CreditCard', 5, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO payment_methods (company_id, name, code, icon_name, sort_order, is_active)
SELECT DISTINCT company_id, 'Cheque', 'cheque', 'Receipt', 6, true FROM profiles WHERE company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;
```

### Step 3: Verify Success
After running the SQL:
- You should see a success message
- The default payment methods will be created for all existing companies
- The error should disappear when you refresh the application

## What This Does

The migration creates:
1. **payment_methods table** with columns:
   - `id` - Unique identifier
   - `company_id` - Links to companies
   - `name` - Display name (e.g., "Cash", "Bank Transfer")
   - `code` - Internal code (e.g., "cash", "bank_transfer")
   - `description` - Optional description
   - `icon_name` - Icon to display (DollarSign, CreditCard, Receipt)
   - `is_active` - Whether the method is active
   - `sort_order` - Display order

2. **Default payment methods**: 
   - Cash
   - Bank Transfer
   - M-Pesa
   - EFT
   - RTGS
   - Cheque

3. **Indexes** for better query performance

## Features After Setup
- ✅ Users can select from existing payment methods
- ✅ Users can create new payment methods
- ✅ Payment methods are company-specific
- ✅ Default methods auto-seed for new companies

## Troubleshooting

If you get an error while running the SQL:

### "relation "companies" does not exist"
- Ensure all base tables are created first (companies, profiles, etc.)
- Run the main database setup SQL from `src/utils/setupDatabase.ts`

### "column "company_id" does not exist"  
- Make sure the companies table has a company_id column
- The profiles table should have a company_id reference

### Still seeing the error after migration?
- Refresh the browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
- Check that your Supabase connection is working
- Check the browser console for more detailed error messages
