# Partial Payments Testing Guide

## Overview

This guide provides comprehensive instructions for testing the partial payment functionality. The system allows recording multiple sequential partial payments against the same invoice, which will automatically update the invoice status and balance.

## Prerequisites

1. Application running (`npm run dev`)
2. User logged in with admin/accountant permissions
3. At least one customer in the system
4. At least one invoice to test against

## Test Suite 1: Basic Partial Payment Workflow

### Test 1.1: Record First Partial Payment

**Objective:** Verify that recording a partial payment creates allocation and updates invoice status.

**Setup:**
1. Navigate to the Invoices page
2. Create or identify an unpaid invoice with total amount of 10,000 KES
3. Note the invoice number and ID
4. Initial state should be: Status = "draft", Balance Due = 10,000 KES

**Steps:**
1. Click "Record Payment" (or navigate to Payments → Record Payment)
2. Select the invoice from dropdown
3. Enter Payment Amount: 3,000 KES
4. Select Payment Date: today
5. Select Payment Method: Cash
6. Leave Reference Number blank (optional)
7. Click "Record Payment"

**Expected Results:**
- ✅ Toast notification: "Payment recorded successfully"
- ✅ Payment appears in Payments list with:
  - Payment Number: PAY-<timestamp>
  - Amount: 3,000 KES
  - Status: Received
  - Allocation: Shows the invoice number
- ✅ Invoice status changes to "partial"
- ✅ Invoice displays: Paid Amount = 3,000 KES, Balance Due = 7,000 KES
- ✅ Payment allocation table shows: allocation amount = 3,000 KES

**Verification:**
```
View Payment Details:
- Click on the payment to view
- Verify Payment Allocations section shows:
  - Invoice Number: [selected invoice]
  - Allocated Amount: 3,000 KES
  - Remaining Balance: 7,000 KES
  - Status: "Partially Allocated" (if payment not fully used)
```

---

### Test 1.2: Record Second Partial Payment to Same Invoice

**Objective:** Verify multiple partial payments accumulate correctly.

**Setup:**
- Previous payment recorded (Test 1.1 completed)
- Invoice currently shows: Paid = 3,000, Balance = 7,000, Status = "partial"

**Steps:**
1. Click "Record Payment" again
2. Select the SAME invoice
3. Enter Payment Amount: 4,000 KES
4. Select Payment Date: same as Test 1.1 (or any valid date)
5. Select Payment Method: Bank Transfer
6. Enter Reference Number: "TRANSFER-001" (optional)
7. Click "Record Payment"

**Expected Results:**
- ✅ Toast notification: "Payment recorded successfully"
- ✅ Second payment appears in Payments list
- ✅ Invoice reflects accumulated changes:
  - Paid Amount = 7,000 KES (3,000 + 4,000)
  - Balance Due = 3,000 KES (10,000 - 7,000)
  - Status = "partial" (still)
- ✅ Two separate payment records exist
- ✅ Two separate allocations exist (one per payment)

**Verification:**
```
Invoice Details:
- View invoice in Invoices page
- Verify Payment History section shows both payments:
  1. Payment #1: 3,000 KES (Cash)
  2. Payment #2: 4,000 KES (Bank Transfer)
- Total Paid: 7,000 KES
```

---

### Test 1.3: Record Final Partial Payment to Complete Invoice

**Objective:** Verify invoice transitions from "partial" to "paid" when fully paid.

**Setup:**
- Two partial payments recorded (Tests 1.1 and 1.2 completed)
- Invoice shows: Paid = 7,000, Balance = 3,000, Status = "partial"

**Steps:**
1. Click "Record Payment"
2. Select the SAME invoice
3. Enter Payment Amount: 3,000 KES (remaining balance)
4. Select Payment Date: same or different date
5. Select Payment Method: M-Pesa
6. Click "Record Payment"

**Expected Results:**
- ✅ Toast notification: "Payment recorded successfully"
- ✅ Third payment appears in Payments list
- ✅ Invoice status changes to "paid":
  - Paid Amount = 10,000 KES
  - Balance Due = 0 KES
  - Status = "paid"
- ✅ Invoice badge shows "Paid" instead of "Partial"
- ✅ Three payment allocations exist

**Verification:**
```
Invoice Details:
- View invoice
- Verify all three payments listed in Payment History
- Total: 3,000 + 4,000 + 3,000 = 10,000 KES
- Status clearly shows "Paid"
```

---

## Test Suite 2: Edge Cases and Variations

### Test 2.1: Unequal Partial Payments

**Objective:** Verify system handles non-round partial amounts.

**Setup:**
- Create a new invoice for 25,750 KES

**Payments:**
1. First: 7,234.50 KES
2. Second: 9,101.25 KES
3. Third: 9,414.25 KES

**Expected Results:**
- ✅ All decimal amounts saved correctly
- ✅ Balance calculations accurate:
  - After payment 1: Balance = 18,515.50
  - After payment 2: Balance = 9,414.25
  - After payment 3: Balance = 0.00
- ✅ No rounding errors
- ✅ Status transitions correctly

---

### Test 2.2: Overpayment Scenario

**Objective:** Verify system handles overpayments (payment > remaining balance).

**Setup:**
- Invoice for 10,000 KES
- First payment: 7,000 KES → Status: partial, Balance: 3,000

**Steps:**
1. Record second payment for 5,000 KES (exceeds remaining 3,000)
2. System should ALLOW this (displays warning but accepts)

**Expected Results:**
- ✅ Payment is recorded
- ✅ Invoice status becomes "paid" (or shows negative balance)
- ✅ Paid Amount = 12,000 KES
- ✅ Balance Due = -2,000 KES (overpayment amount)
- ✅ UI handles this gracefully (shows as "Paid")

**Note:** This is expected behavior. Overpayments represent:
- Advance payments
- Refunds to be credited
- Adjustments to future invoices

---

### Test 2.3: Payment Reversal During Partial State

**Objective:** Verify deletion of a payment reverses allocations correctly.

**Setup:**
- Invoice with 3 payments recorded (total 10,000):
  - Payment 1: 3,000 KES
  - Payment 2: 4,000 KES
  - Payment 3: 3,000 KES
- Invoice Status: paid, Paid: 10,000, Balance: 0

**Steps:**
1. Navigate to Payments page
2. Find Payment 2 (4,000 KES)
3. Click on payment row → View/Delete option
4. Click "Delete Payment"
5. Confirm deletion

**Expected Results:**
- ✅ Payment 2 record is deleted
- ✅ Allocation for Payment 2 is deleted
- ✅ Invoice is updated:
  - Paid Amount = 6,000 KES (3,000 + 3,000)
  - Balance Due = 4,000 KES
  - Status = "partial" (reverts from "paid")
- ✅ Only 2 payments remain in payment history
- ✅ No orphaned allocations in database

**Verification:**
```
Invoice:
- Should show Paid: 6,000, Balance: 4,000, Status: partial
- Payment history should list only Payment 1 and Payment 3

Payments:
- Only 2 payments should remain for this invoice
- One with 3,000 KES, one with 3,000 KES
```

---

### Test 2.4: Multiple Payments on Different Dates

**Objective:** Verify payment dates are preserved and payment history is chronological.

**Setup:**
- Create invoice for 15,000 KES

**Payments with specific dates:**
1. Payment 1: 5,000 KES, Date: 2024-01-15
2. Payment 2: 5,000 KES, Date: 2024-02-10  
3. Payment 3: 5,000 KES, Date: 2024-01-20 (EARLIER than Payment 2)

**Expected Results:**
- ✅ All three payments recorded
- ✅ Payment dates preserved exactly as entered
- ✅ Invoice shows accumulated balance regardless of payment order:
  - Paid: 15,000, Balance: 0, Status: paid
- ✅ Payment history can be sorted by date if needed
- ✅ Allocations created for all payments

---

### Test 2.5: Negative Amount (Refund/Adjustment)

**Objective:** Verify system handles refunds and adjustments.

**Setup:**
- Invoice for 10,000 KES
- Already has 10,000 paid (Status: paid)

**Steps:**
1. Record new payment
2. Amount: -1,500 KES (negative, for refund/adjustment)
3. Select same invoice
4. Note: Button should show "Record Adjustment/Refund"
5. Click button

**Expected Results:**
- ✅ Negative payment recorded
- ✅ Invoice balance updated:
  - Paid Amount = 8,500 KES (10,000 - 1,500)
  - Balance Due = 1,500 KES
  - Status = "partial"
- ✅ Payment shown with negative amount in history
- ✅ Allocation shows negative amount

---

## Test Suite 3: Multi-Invoice Partial Payments

### Test 3.1: Multiple Invoices from Same Customer

**Objective:** Verify system correctly handles payments split across multiple invoices.

**Setup:**
- Customer has 2 unpaid invoices:
  - Invoice A: 10,000 KES
  - Invoice B: 8,000 KES

**Payment Approach:**
1. Record payment 1: 5,000 KES to Invoice A → Balance A: 5,000
2. Record payment 2: 4,000 KES to Invoice B → Balance B: 4,000
3. Record payment 3: 5,000 KES to Invoice A → Balance A: 0, Status A: paid
4. Record payment 4: 4,000 KES to Invoice B → Balance B: 0, Status B: paid

**Expected Results:**
- ✅ Each payment correctly allocated to specified invoice
- ✅ Invoice A shows: 2 payments, Paid: 10,000, Status: paid
- ✅ Invoice B shows: 2 payments, Paid: 8,000, Status: paid
- ✅ Each payment allocation links to correct invoice
- ✅ No cross-allocation between invoices

---

## Test Suite 4: Payment UI Verification

### Test 4.1: Payments Page Display

**Objective:** Verify Payments page correctly displays partial payments.

**Steps:**
1. Navigate to Payments page
2. Review payment list

**Expected:**
- ✅ All payments visible
- ✅ Payment method badges display correctly
- ��� Each payment shows associated invoice number
- ✅ Total amount in each row is correct
- ✅ Allocations section shows invoice details

**Column Verification:**
| Column | Expected | Status |
|--------|----------|--------|
| Payment # | PAY-<timestamp> | ✅ |
| Date | Recorded date | ✅ |
| Customer | Customer name | ✅ |
| Amount | Payment amount | ✅ |
| Method | Payment method badge | ✅ |
| Invoice | Associated invoice # | ✅ |
| Status | "Received" | ✅ |

---

### Test 4.2: Invoice Page Display

**Objective:** Verify Invoice page shows partial payment status correctly.

**Steps:**
1. Navigate to Invoices page
2. Find invoice with partial payments

**Expected Display:**
- ✅ Status badge shows "Partial" (if balance remains)
- ✅ Status badge shows "Paid" (if fully paid)
- ✅ Total Amount: clearly visible
- ✅ Paid Amount: shows accumulated total
- ✅ Balance Due: shows remaining balance
- ✅ Payment History section lists all allocations

**Example Display:**
```
Invoice: INV-001
Customer: Acme Corp
Status: Partial (badge)

Total Amount: 10,000.00 KES
Paid Amount: 7,000.00 KES
Balance Due: 3,000.00 KES

Payment History:
1. PAY-001 - 3,000 KES - Cash - 2024-01-15
2. PAY-002 - 4,000 KES - Bank Transfer - 2024-02-01
```

---

## Test Suite 5: Data Integrity

### Test 5.1: Payment Allocation Consistency

**Objective:** Verify payment_allocations table maintains correct data.

**Database Query:**
```sql
SELECT 
  p.payment_number,
  p.amount,
  i.invoice_number,
  i.total_amount,
  i.paid_amount,
  i.balance_due,
  pa.amount_allocated,
  (pa.amount_allocated = p.amount) as "allocation_matches_payment"
FROM 
  payments p
  LEFT JOIN payment_allocations pa ON p.id = pa.payment_id
  LEFT JOIN invoices i ON pa.invoice_id = i.id
ORDER BY 
  p.created_at DESC;
```

**Expected Results:**
- ✅ Each payment has at least one allocation
- ✅ allocation_amount = payment amount (usually)
- ✅ No null invoices for allocations
- ✅ Sum of allocations per invoice = invoice.paid_amount

### Test 5.2: Invoice Balance Verification

**Objective:** Verify invoice balance calculations are accurate.

**Database Query:**
```sql
SELECT 
  i.invoice_number,
  i.total_amount,
  i.paid_amount,
  i.balance_due,
  i.status,
  SUM(pa.amount_allocated) as "calculated_paid",
  (i.total_amount - SUM(pa.amount_allocated)) as "calculated_balance",
  (i.paid_amount = SUM(pa.amount_allocated)) as "paid_matches",
  (i.balance_due = (i.total_amount - SUM(pa.amount_allocated))) as "balance_matches"
FROM 
  invoices i
  LEFT JOIN payment_allocations pa ON i.id = pa.invoice_id
WHERE 
  i.status IN ('partial', 'paid')
GROUP BY 
  i.id, i.invoice_number, i.total_amount, i.paid_amount, i.balance_due, i.status
HAVING 
  (i.paid_amount != SUM(pa.amount_allocated) OR 
   i.balance_due != (i.total_amount - SUM(pa.amount_allocated)));
```

**Expected Results:**
- ✅ No rows returned (all balances match calculations)
- ✅ If rows appear: data corruption, needs reconciliation

---

## Test Suite 6: Payment Method Variations

### Test 6.1: Different Payment Methods

**Objective:** Verify system works with different payment methods.

**Setup:**
- Invoice for 10,000 KES

**Payments using different methods:**
1. Payment 1: 2,000 KES - Cash
2. Payment 2: 3,000 KES - Bank Transfer
3. Payment 3: 2,500 KES - M-Pesa
4. Payment 4: 2,500 KES - Cheque

**Expected Results:**
- ✅ All payments recorded successfully
- ✅ No "Invalid payment method" errors
- ✅ Each shows correct method in UI
- ✅ Invoice fully paid: 2,000 + 3,000 + 2,500 + 2,500 = 10,000
- ✅ Status: paid

---

## Testing Checklist

### Core Functionality
- [ ] Record first partial payment to invoice
- [ ] Record second partial payment to same invoice
- [ ] Record third payment to complete invoice
- [ ] Invoice status transitions: draft → partial → paid
- [ ] Balance calculations are accurate after each payment
- [ ] Payment allocations created for each payment

### Edge Cases
- [ ] Unequal partial amounts (decimals)
- [ ] Overpayment scenario (payment > balance)
- [ ] Payment reversal during partial state
- [ ] Payments on different dates
- [ ] Negative amounts (refunds)

### Multiple Invoices
- [ ] Payments split across multiple invoices
- [ ] Each invoice tracks own allocations
- [ ] No cross-allocation issues

### Data Integrity
- [ ] Payment allocations are consistent
- [ ] Invoice balances match allocation sum
- [ ] No orphaned allocations after deletion
- [ ] Rounding handled correctly

### UI Display
- [ ] Partial status badge displays correctly
- [ ] Payment history shows all payments
- [ ] Balance Due updates in real-time
- [ ] Payment list shows invoice associations

---

## Known Limitations

1. **Overpayments:** System allows overpayments (payment > balance). This is by design to support:
   - Advance payments
   - Partial refunds
   - Adjustment payments

2. **Payment Grouping:** Each payment is independent. No automatic grouping of related partials. (Can be added in future if needed)

3. **Audit Trail:** Current system tracks payment creation but limited historical audit. Enhancement recommended for compliance.

---

## Troubleshooting

### Issue: Payment not allocated to invoice
**Cause:** payment_allocations table may not exist
**Solution:** 
1. Run database migration to create table
2. Use PaymentAllocationQuickFix component
3. Check PAYMENT_METHODS_SETUP.md

### Issue: Balance Due not updating
**Cause:** Invoice update failed (likely RLS)
**Solution:**
1. Check browser console for error
2. Verify user profile linked to company
3. Check RLS policies on invoices table

### Issue: Status not changing to "paid"
**Cause:** Balance calculation logic
**Solution:**
1. Verify balance_due = 0 or less
2. Check invoice status enum includes 'paid'
3. Verify 'partial' enum value exists

---

## Sign-Off

**Test Date:** ___________
**Tester Name:** ___________
**Test Environment:** Development/Staging/Production

**Summary:**
- [ ] All tests passed
- [ ] Some tests failed (document below)
- [ ] Issues found and documented

**Issues Found:**
_____________________________________________________________
_____________________________________________________________

**Conclusion:** System is [ready for production / needs fixes / pending]
