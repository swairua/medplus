# Invoice Balance Update Error - Fix Summary

## Error
```
Failed to update invoice balance: [object Object]
```

## Root Causes

### 1. Schema Column Name Mismatch
**Problem**: setupDatabase.ts used incorrect column names:
- Using: `amount_paid`, `amount_due`
- Should be: `paid_amount`, `balance_due`

**Impact**: When the payment hook tried to update invoices with the correct column names, the query failed silently because those columns didn't exist in databases created with setupDatabase.ts.

### 2. Poor Error Logging
**Problem**: Error object was being logged directly instead of extracting the message:
```javascript
console.error('Failed to update invoice balance:', invoiceError);  // Logs as [object Object]
```

**Impact**: Made debugging difficult - no visibility into the actual error message.

## Solution

### Fix 1: Correct Schema Column Names
**File**: `src/utils/setupDatabase.ts` (lines 186-208)

**Changed**:
```javascript
// BEFORE (WRONG)
amount_paid DECIMAL(15,2) DEFAULT 0,
amount_due DECIMAL(15,2) DEFAULT 0,

// AFTER (CORRECT)
paid_amount DECIMAL(15,2) DEFAULT 0,
balance_due DECIMAL(15,2) DEFAULT 0,
```

Now matches:
- `database-schema.sql` ✓
- `COMPREHENSIVE_DATABASE_MIGRATION.sql` ✓
- `useDatabase.ts` hooks ✓

### Fix 2: Enhanced Error Logging
**File**: `src/hooks/useDatabase.ts` (lines 1156-1165)

**Changed**:
```javascript
// BEFORE (POOR LOGGING)
if (invoiceError) {
  console.error('Failed to update invoice balance:', invoiceError);
  // Continue anyway - payment and allocation were recorded
}

// AFTER (DETAILED LOGGING)
if (invoiceError) {
  const errorMessage = invoiceError?.message || JSON.stringify(invoiceError);
  console.error('Failed to update invoice balance:', errorMessage);
  console.error('Invoice update error details:', {
    message: invoiceError?.message,
    code: invoiceError?.code,
    details: invoiceError?.details,
    hint: invoiceError?.hint,
    status: invoiceError?.status
  });
  // Continue anyway - payment and allocation were recorded
}
```

Now logs:
- ✓ Actual error message
- ✓ Error code (useful for Supabase debugging)
- ✓ Error details (schema/constraint info)
- ✓ Hint (SQL hint messages)
- ✓ HTTP status code

## Impact

### For New Databases
- No impact (setupDatabase.ts now has correct schema)
- Payments will work correctly

### For Existing Databases
**If using old setupDatabase.ts schema** (with amount_paid/amount_due):
1. Invoice balance updates will still fail silently
2. Need to run schema migration to rename columns:

```sql
-- Rename columns to match standard schema
ALTER TABLE invoices RENAME COLUMN amount_paid TO paid_amount;
ALTER TABLE invoices RENAME COLUMN amount_due TO balance_due;
```

**If using correct schema** (paid_amount/balance_due):
- Payments will now work correctly
- Error logging will show what's wrong if issues occur

## Testing

### Test Case 1: Payment with Balance Update
1. Create invoice (Ksh 10,000)
2. Record payment (Ksh 7,000)
3. Check invoice:
   - paid_amount should be 7,000
   - balance_due should be 3,000
   - status should be "partial"

### Test Case 2: Full Payment
1. Create invoice (Ksh 5,000)
2. Record payment (Ksh 5,000)
3. Check invoice:
   - paid_amount should be 5,000
   - balance_due should be 0
   - status should be "paid"

### Test Case 3: Error Logging
1. Record payment
2. Open browser Console (F12)
3. If any error occurs, should see detailed error info (not [object Object])

## Files Modified

| File | Change | Impact |
|------|--------|--------|
| `src/utils/setupDatabase.ts` | Fixed column names: `amount_paid` → `paid_amount`, `amount_due` → `balance_due` | New databases will have correct schema |
| `src/hooks/useDatabase.ts` | Enhanced error logging in invoice balance update | Better debugging information |

## Related Files (No Changes Needed)

✓ `database-schema.sql` - Already correct
✓ `COMPREHENSIVE_DATABASE_MIGRATION.sql` - Already correct
✓ `src/hooks/useDatabase.ts` Interface definitions - Already correct
✓ `src/components/payments/RecordPaymentModal.tsx` - Already correct

## Deployment Checklist

- [x] Fixed setupDatabase.ts schema
- [x] Enhanced error logging
- [ ] Test with new database
- [ ] Test with existing database (may need column rename)
- [ ] Run payment recording test
- [ ] Verify console shows proper error messages

## Status

✅ **FIXED** - Ready for testing and deployment

The error should no longer occur, and if it does, the console will show the actual error message instead of `[object Object]`.
