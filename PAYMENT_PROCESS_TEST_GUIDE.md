# Payment Process Testing Guide

## Overview

This guide provides step-by-step instructions to test the fixed payment recording process with custom and default payment methods.

## Prerequisites

1. Database migration applied: `migrations/fix_payment_method_enum.sql`
2. Application running: `npm run dev`
3. User logged in with admin/accountant permissions
4. At least one customer and invoice in the system

## Test Case 1: Record Payment with Default Payment Method

### Setup
1. Navigate to Payments page
2. Create or identify an unpaid invoice

### Steps
1. Click "Record Payment" button
2. Select the invoice from the dropdown
3. Verify invoice details display (invoice number, customer, amounts)
4. Select "Cash" as payment method
5. Enter payment amount (should match or be less than balance due)
6. Enter payment date
7. Click "Record Payment"

### Expected Result
✅ Payment recorded successfully
✅ Toast notification shows success
✅ Payment appears in payment history
✅ Invoice balance updated correctly

---

## Test Case 2: Record Payment with Custom Payment Method

### Setup
1. Navigate to Payments page
2. Ensure a custom payment method exists or create one:
   - Click "Add New" button next to Payment Method
   - Enter Name: "Express Transfer" (or similar)
   - Enter Code: "express" (lowercase, no spaces)
   - Click "Create Method"

### Steps
1. Click "Record Payment" button
2. Select an unpaid invoice
3. In Payment Method dropdown, select the newly created "Express Transfer" method
4. Enter payment amount
5. Enter payment date
6. Click "Record Payment"

### Expected Result
✅ Payment recorded with custom method
✅ No "Invalid enum" errors in browser console
✅ Payment method displays correctly in payment history
✅ Payment summary shows custom payment method name

---

## Test Case 3: Record Payment with Multiple Custom Methods

### Setup
Create three custom payment methods:
1. Name: "Bitcoin", Code: "btc"
2. Name: "PayPal", Code: "paypal"
3. Name: "Mobile Wallet", Code: "mobile_wallet"

### Steps
For each custom method:
1. Click "Record Payment"
2. Select an unpaid invoice
3. Select the custom payment method
4. Enter amount and date
5. Record payment

### Expected Result
✅ All three payments recorded successfully
✅ All custom methods appear in payment history
✅ Each payment shows correct method name and code
✅ No validation errors in browser console

---

## Test Case 4: Verify Payment Method Display

### Steps
1. Go to Payments page
2. Look at Payment History table
3. Check "Method" column for various entries

### Expected Result
✅ All payment methods display correctly
✅ Custom payment methods show as badges with proper formatting
✅ Method names are properly capitalized (underscores replaced with spaces)
✅ Badge colors:
   - Cash: Green
   - Bank Transfer, Mobile Money: Blue
   - Cheque: Orange/Warning
   - Custom methods: Gray (default)

---

## Test Case 5: Browser Console Verification

### Steps
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Record a payment with a custom method
4. Check console output

### Expected Result
✅ No errors about "Invalid input value for enum payment_method"
✅ No TypeScript errors about payment_method type mismatch
✅ Payment creation should complete successfully
✅ Console shows normal info logs without errors

---

## Test Case 6: Negative Amount Handling (Refunds)

### Setup
Identify an invoice with a paid amount

### Steps
1. Click "Record Payment"
2. Select the invoice
3. Enter a NEGATIVE amount (e.g., -1000)
4. Verify it says "Record Adjustment/Refund" button
5. Click button

### Expected Result
✅ Refund/adjustment recorded
✅ Invoice balance updated accordingly
✅ Payment appears in history with negative amount
✅ No validation errors

---

## Test Case 7: Payment Allocation Verification

### Steps
1. Record a payment against an invoice
2. View the payment details
3. Check payment allocations

### Expected Result
✅ Payment allocated to correct invoice
✅ Allocation amount matches payment amount
✅ Invoice balance updates:
   - paid_amount increases
   - balance_due decreases
✅ If invoice balance reaches 0, status changes to "paid"

---

## Regression Tests

### Test: Default Payment Methods Still Work
Record payments using:
- [ ] Cash
- [ ] Bank Transfer
- [ ] M-Pesa
- [ ] EFT
- [ ] RTGS
- [ ] Cheque

All should work without "Invalid enum" errors.

### Test: Payment Search and Filter
1. Record multiple payments with different methods
2. Use search to find payments by:
   - Customer name
   - Payment number
   - Invoice number

Expected: All searches work correctly regardless of payment method used.

### Test: Payment Receipt Download
1. Record a payment
2. Click download button
3. Verify PDF downloads correctly

Expected: Receipt includes correct payment method name.

---

## Troubleshooting

### Issue: "Invalid input value for enum payment_method"
**Cause**: Database migration not applied
**Solution**: 
1. Run migration: `migrations/fix_payment_method_enum.sql`
2. Refresh browser
3. Try recording payment again

### Issue: Payment method dropdown empty
**Cause**: Payment methods table not seeded
**Solution**:
1. Click "Create First Payment Method"
2. Enter default payment method details
3. Or check PAYMENT_METHODS_SETUP.md

### Issue: Custom payment method appears in dropdown but payment fails
**Cause**: Payment recorded but allocation failed (likely RLS issue)
**Solution**:
1. Check browser console for error details
2. Verify user profile is linked to company
3. Check RLS policies on payment_allocations table

### Issue: Payment method name shows as code in history
**Example**: Shows "exp" instead of "Express"
**Cause**: Payment method record missing or deleted
**Solution**:
1. Recreate the payment method with same code
2. Payments already recorded will still show the code

---

## Database Verification

### Verify Schema Change
Execute in Supabase SQL Editor:

```sql
-- Check payment_method column type
SELECT 
    column_name,
    data_type,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'payments' 
    AND column_name = 'payment_method';
```

Expected result:
```
column_name    | data_type | is_nullable
payment_method | character varying | NO
```

### Verify Payment Methods Table
```sql
SELECT 
    company_id,
    name,
    code,
    is_active,
    sort_order
FROM 
    payment_methods
ORDER BY 
    sort_order;
```

Expected: All payment methods with code values (not enum type).

---

## Success Criteria

✅ All test cases pass without enum validation errors
✅ Custom payment methods can be created and used
✅ Default payment methods continue to work
✅ Payment allocations work correctly
✅ Payment history displays all methods properly
✅ No TypeScript type errors
✅ No console errors related to payment_method
✅ Negative amounts (refunds) work correctly
✅ PDF receipts include correct payment method

## Sign-Off

Date Tested: ________________
Tester Name: ________________
All Tests Passed: ☐ Yes ☐ No

Notes:
_________________________________________________________________
_________________________________________________________________
