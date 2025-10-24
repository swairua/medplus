# Credit Notes Delete Feature - Testing Guide

## Testing Checklist

### UI/UX Testing

#### 1. Delete Button Visibility
- [ ] Navigate to Credit Notes page
- [ ] Verify trash icon appears in Actions column for each row
- [ ] Verify button is red/destructive colored
- [ ] Hover over button and see tooltip "Delete credit note"

#### 2. Delete Modal Display
- [ ] Click delete button on any credit note
- [ ] Modal appears with title "Delete Credit Note"
- [ ] Modal shows warning icon and "This action cannot be undone" message
- [ ] Credit note details are displayed (number, customer, amounts, status)
- [ ] Related records count is shown (items, allocations, inventory movements)

#### 3. Confirmation Workflow
- [ ] Confirm checkbox is unchecked by default
- [ ] Delete button is disabled when checkbox is unchecked
- [ ] Checking checkbox enables delete button
- [ ] Unchecking checkbox disables delete button again
- [ ] Clicking Cancel closes modal without deleting

#### 4. Success Feedback
- [ ] Click Delete after confirming
- [ ] Success toast appears: "Credit note deleted successfully! All related records have been updated."
- [ ] Modal closes
- [ ] Table refreshes and credit note is no longer visible

#### 5. Error Handling
- [ ] Try deleting a credit note with applied allocations
- [ ] Verify proper error message if deletion fails
- [ ] Verify error toast appears
- [ ] Modal remains open for retry

### Functional Testing

#### Test Case 1: Simple Credit Note (No Items)
**Setup:**
1. Create a credit note with no line items
2. Keep status as 'draft'
3. Don't apply to any invoices

**Test:**
1. Click delete button
2. Modal shows "0 line item(s) will be deleted"
3. Modal shows "No allocations to invoice(s)"
4. Confirm and delete
5. **Verify:**
   - Credit note is deleted from table
   - Audit log entry created with items_count: 0, allocations_count: 0

#### Test Case 2: Credit Note with Items
**Setup:**
1. Create a credit note with 3 line items
2. Keep status as 'draft'
3. Don't apply to any invoices

**Test:**
1. Click delete button
2. Modal shows "3 line item(s) will be deleted"
3. Confirm and delete
4. **Verify:**
   - Credit note is deleted
   - Related items are deleted (check database)
   - Audit log shows items_count: 3

#### Test Case 3: Credit Note Applied to Invoice
**Setup:**
1. Create a credit note with 500 KES amount
2. Apply it to an invoice (allocate 500 KES)
3. Note the original invoice balance_due

**Test:**
1. Click delete button
2. Modal shows allocation warning and "Allocations to invoice(s)"
3. Confirm and delete
4. **Verify:**
   - Credit note is deleted
   - Allocation is deleted from database
   - Invoice balance_due is restored (increased by 500)
   - Audit log shows allocations_count: 1, affected_invoices: [invoice-id]

#### Test Case 4: Partially Applied Credit Note
**Setup:**
1. Create a credit note with 1000 KES total
2. Apply 600 KES to one invoice
3. Keep 400 KES balance

**Test:**
1. Click delete button
2. Modal shows Applied: 600 KES, Balance: 400 KES
3. Confirm and delete
4. **Verify:**
   - Credit note deleted
   - Applied amount (600) is reversed from invoice balance_due
   - Balance (400) is not applied anywhere
   - Audit log shows applied_amount: 600

#### Test Case 5: Inventory-Affecting Credit Note
**Setup:**
1. Create a credit note with affects_inventory = true
2. Add items with products
3. Keep as draft (don't apply)

**Test:**
1. Click delete button
2. Modal shows "Inventory movements will be reversed (stock will be adjusted)"
3. Confirm and delete
4. **Verify:**
   - Credit note is deleted
   - Stock movements with reference_type='CREDIT_NOTE' are found
   - Reversing movements created with opposite movement_type
   - Reversals have reference_type='CREDIT_NOTE_REVERSAL'
   - Audit log shows inventory_affected: true, stock_movements_reversed: N

#### Test Case 6: Complex Credit Note
**Setup:**
1. Create credit note with:
   - 5 line items
   - affects_inventory = true
   - Status = 'sent'
   - Applied to 2 different invoices (300 + 200 KES)
   - Total = 1000 KES, Applied = 500 KES, Balance = 500 KES

**Test:**
1. Click delete button
2. Modal displays all impacts:
   - 5 line items
   - Allocations to 2 invoices
   - Inventory movements reversed
3. Confirm and delete
4. **Verify:**
   - All items deleted
   - Both invoice allocations deleted and balances restored
   - Stock movements reversed
   - Audit log contains all details

### Audit Logging Testing

#### 1. Audit Log Table
**Test:**
1. Delete several credit notes
2. Query audit_logs table:
   ```sql
   SELECT * FROM audit_logs 
   WHERE entity_type = 'credit_note' 
   ORDER BY created_at DESC;
   ```
3. **Verify:**
   - Each deletion has an entry
   - action = 'DELETE'
   - entity_type = 'credit_note'
   - actor_email is current user
   - created_at is recent timestamp
   - details JSON contains all required fields

#### 2. Audit Log Details Content
**Test:**
1. Delete a credit note with known details
2. Query the audit log entry
3. **Verify details JSON contains:**
   - credit_note_number: matches deleted note
   - customer_id: correct UUID
   - total_amount: correct decimal
   - applied_amount: correct decimal
   - items_count: correct integer
   - allocations_count: correct integer
   - affected_invoices: array of invoice IDs
   - inventory_affected: boolean
   - stock_movements_reversed: integer

#### 3. Multi-User Audit Trail
**Test (if multi-user available):**
1. Delete as user A
2. Delete as user B
3. Query audit logs
4. **Verify:**
   - Each entry shows correct actor_email
   - Both deletions are recorded separately
   - Timestamps are different

### Database Integrity Testing

#### 1. Cascade Deletes
**Test:**
1. Create credit note with items and allocations
2. Note the credit note ID
3. Delete the credit note via UI
4. **Verify in database:**
   ```sql
   -- Should return 0 rows
   SELECT * FROM credit_notes WHERE id = 'deleted-id';
   SELECT * FROM credit_note_items WHERE credit_note_id = 'deleted-id';
   SELECT * FROM credit_note_allocations WHERE credit_note_id = 'deleted-id';
   ```

#### 2. Invoice Balance Integrity
**Test:**
1. Create invoice with balance_due = 1000
2. Apply credit note for 300 to it (balance_due becomes 700)
3. Delete the credit note
4. **Verify:**
   ```sql
   SELECT balance_due FROM invoices WHERE id = 'invoice-id';
   -- Should return 1000
   ```

#### 3. Stock Movement Integrity
**Test:**
1. Create credit note with affects_inventory = true
2. Add product item (this creates IN or OUT movement)
3. Note total stock movements count for this credit note
4. Delete the credit note
5. **Verify:**
   ```sql
   -- Original movements still exist
   SELECT COUNT(*) FROM stock_movements 
   WHERE reference_type='CREDIT_NOTE' AND reference_id='deleted-id';
   
   -- Reversals created
   SELECT COUNT(*) FROM stock_movements 
   WHERE reference_type='CREDIT_NOTE_REVERSAL' AND reference_id='deleted-id';
   -- Count should match original count
   ```

### Edge Cases & Error Scenarios

#### 1. Delete with Network Error
**Test:**
1. Start deletion
2. Simulate network error (DevTools -> Offline)
3. **Expected:** Error toast appears, modal remains open

#### 2. Delete Invoice That Got Deleted
**Test:**
1. Create credit note applied to invoice A
2. Manually delete invoice A from database
3. Try to delete the credit note
4. **Expected:** Should handle gracefully, either skip update or show clear error

#### 3. Concurrent Deletions
**Test (if multi-window possible):**
1. Open credit notes in 2 windows
2. Delete same credit note in both windows
3. **Expected:** One succeeds, other gets error about record not found

#### 4. Delete Non-Draft Status
**Test:**
1. Create credit note with status 'sent' or 'applied'
2. **Expected:** Delete button still available (no restriction by status)
3. Can delete successfully

#### 5. Very Large Credit Note
**Test:**
1. Create credit note with 100+ items
2. Apply to 10+ invoices
3. Delete it
4. **Expected:** Still deletes successfully (may take a moment)

## Performance Testing

### Scenario: Delete Credit Note with 50 Items and 20 Allocations

**Metrics to Monitor:**
1. Time to show confirmation modal: < 1 second
2. Time to execute delete: < 5 seconds
3. Time for UI to refresh: < 2 seconds
4. No console errors
5. Audit log created successfully

**Test Command:**
```typescript
const startTime = performance.now();
await deleteCreditNote.mutateAsync(creditNoteId);
const endTime = performance.now();
console.log(`Delete took ${endTime - startTime}ms`);
```

## Rollback/Undo Testing

**Current Status:** No built-in undo feature

**Test:**
1. Delete a credit note
2. Note the ID and details
3. **Verify:** Cannot be undone through UI
4. **Alternative:** Manual database restoration would be required

## Checklist Summary

- [ ] All UI elements display correctly
- [ ] Delete button is accessible and visible
- [ ] Confirmation modal shows all required information
- [ ] Checkbox prevents accidental deletion
- [ ] Simple credit notes delete successfully
- [ ] Credit notes with items delete with items
- [ ] Applied credit notes reverse allocations correctly
- [ ] Inventory movements are reversed properly
- [ ] Audit logs record all deletions with details
- [ ] Related invoices have balances restored
- [ ] Error handling works gracefully
- [ ] Performance is acceptable
- [ ] No data loss or orphaned records
- [ ] Multi-user audit trail works

## Test Report Template

```markdown
# Credit Notes Delete Feature - Test Report
Date: [DATE]
Tester: [NAME]
Environment: [DEV/STAGING/PROD]

## Test Results
- [ ] All basic tests passed
- [ ] All functional tests passed
- [ ] All edge cases handled
- [ ] Performance acceptable
- [ ] Audit logging complete

## Issues Found
[List any issues with severity: Critical/High/Medium/Low]

## Notes
[Any additional observations]
```
