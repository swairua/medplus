# Credit Notes Delete with Audit Logging

## Overview

This document describes the implementation of the per-row delete functionality for credit notes with comprehensive audit logging and cascade updates.

## Features Implemented

### 1. Delete Per Row Action
- A delete button (trash icon) is now visible on each credit note row in the Credit Notes table
- Button is styled with destructive colors to indicate a permanent action
- Accessible from the Actions column on the right side of each row

### 2. Delete Confirmation Modal
- **Component**: `src/components/credit-notes/DeleteCreditNoteModal.tsx`
- Shows a detailed confirmation dialog with:
  - Credit note summary (number, status, customer, amounts)
  - Impact assessment showing:
    - Number of line items to be deleted
    - Allocated amounts that will be reversed
    - Inventory movements that will be reversed
  - Audit trail notification
  - Checkbox to confirm understanding of consequences
  - Disable delete button until checkbox is checked

### 3. Cascade Delete Handling
When a credit note is deleted, the following automatic cascade operations occur:

#### 3.1 Related Records Deletion (Database Level)
- **Credit Note Items**: Automatically deleted via database ON DELETE CASCADE
- **Credit Note Allocations**: Automatically deleted via database ON DELETE CASCADE

#### 3.2 Invoice Balance Updates
- For each credit note allocation, the related invoice's `balance_due` is recalculated
- Formula: `new_balance_due = current_balance_due + allocated_amount`
- This reverses the effect of the credit note application

#### 3.3 Inventory Reversal
- If `affects_inventory` is true on the credit note:
  - All stock movements with reference_type='CREDIT_NOTE' are found
  - Reversing stock movements are created with:
    - Opposite movement_type (IN ↔ OUT)
    - reference_type='CREDIT_NOTE_REVERSAL'
    - Original quantity and cost
    - Enhanced notes with reversal information

### 4. Audit Logging
- **Enhanced Logger**: `src/utils/auditLogger.ts`
  - Added 'credit_note' to AuditedEntity type
  - Supports comprehensive audit log entries

- **Deletion Log Entry** includes:
  ```json
  {
    "action": "DELETE",
    "entity_type": "credit_note",
    "record_id": "uuid",
    "company_id": "uuid",
    "actor_user_id": "uuid",
    "actor_email": "user@example.com",
    "details": {
      "credit_note_number": "CN-001",
      "customer_id": "uuid",
      "total_amount": 1000.00,
      "applied_amount": 500.00,
      "items_count": 3,
      "allocations_count": 2,
      "affected_invoices": ["inv-1", "inv-2"],
      "inventory_affected": true,
      "stock_movements_reversed": 3
    }
  }
```

## Files Modified/Created

### New Files
1. **src/components/credit-notes/DeleteCreditNoteModal.tsx**
   - Confirmation dialog component
   - Shows impact summary and related records
   - Requires explicit confirmation before deletion

### Modified Files
1. **src/utils/auditLogger.ts**
   - Added 'credit_note' to AuditedEntity type union
   - No other changes needed (already supports custom details)

2. **src/hooks/useCreditNotes.ts**
   - Enhanced `useDeleteCreditNote()` hook with:
     - Complete credit note data fetching (items, allocations)
     - Inventory reversal logic
     - Invoice balance updates
     - Comprehensive audit logging

3. **src/pages/CreditNotes.tsx**
   - Added delete modal state management
   - Integrated DeleteCreditNoteModal component
   - Added delete button to table actions
   - Wired up delete handler with proper cleanup

## Usage Instructions

### For End Users

1. **Navigate to Credit Notes**: Go to the Credit Notes page
2. **Find the Credit Note**: Search or filter the list to find the credit note to delete
3. **Click Delete Button**: Click the trash icon in the Actions column for that row
4. **Review Impact**: The confirmation modal displays:
   - The credit note details
   - Number of related records being affected
   - Specific impacts (items, allocations, inventory)
5. **Confirm Deletion**: 
   - Read the impact summary carefully
   - Check the "I understand..." checkbox
   - Click "Delete Credit Note" button
6. **Verification**: 
   - Success toast appears confirming deletion
   - Credit note and related records are removed
   - Audit log is created with full details

### For Developers

#### Testing Delete Functionality

```typescript
// 1. Create a test credit note with items and allocations
const creditNote = await createCreditNote({
  customer_id: '...',
  company_id: '...',
  credit_note_number: 'CN-TEST-001',
  total_amount: 1000,
  affects_inventory: true
});

// 2. Create line items
await createCreditNoteItem({
  credit_note_id: creditNote.id,
  product_id: '...',
  quantity: 10,
  unit_price: 100
});

// 3. Apply to an invoice
await applyCreditNoteToInvoice({
  creditNoteId: creditNote.id,
  invoiceId: '...',
  amount: 500
});

// 4. Delete the credit note
const deleteHook = useDeleteCreditNote();
await deleteHook.mutateAsync(creditNote.id);

// 5. Verify results
// - Credit note is deleted
// - Items are deleted (cascade)
// - Allocations are deleted (cascade)
// - Invoice balance_due is restored
// - Stock movements are reversed
// - Audit log contains full details
```

#### Audit Log Verification

Query the audit logs to verify deletions:

```sql
SELECT * FROM audit_logs 
WHERE entity_type = 'credit_note' 
AND action = 'DELETE'
ORDER BY created_at DESC;
```

View deletion details:

```sql
SELECT 
  created_at,
  actor_email,
  details->>'credit_note_number' as note_number,
  details->>'items_count' as items_deleted,
  details->>'allocations_count' as allocations_deleted,
  details->>'stock_movements_reversed' as movements_reversed
FROM audit_logs 
WHERE entity_type = 'credit_note' AND action = 'DELETE';
```

## Database Constraints and Cascade Behavior

### Existing ON DELETE CASCADE Constraints
```sql
credit_note_items.credit_note_id → credit_notes(id) ON DELETE CASCADE
credit_note_allocations.credit_note_id → credit_notes(id) ON DELETE CASCADE
```

### Manual Updates (Handled by Application)
- Invoice `balance_due` adjustment for each allocation
- Stock movement reversals for inventory-affected credit notes

## Error Handling

The implementation includes comprehensive error handling:

1. **Fetch Errors**: If credit note cannot be fetched, deletion is aborted
2. **Stock Movement Errors**: Gracefully handles missing stock_movements table
3. **Invoice Update Errors**: Continues even if invoice update fails (logged)
4. **Audit Log Errors**: Logs warning but doesn't block deletion
5. **User Feedback**: Toast notifications for success or error states

## Performance Considerations

- Deleting a credit note with many items/allocations requires N+1 invoice updates
- Stock movement reversal is done via bulk insert for efficiency
- Audit logging is asynchronous and non-blocking
- Database cascade deletes provide efficient cleanup of related records

## Security Considerations

- User authentication is verified for audit logging
- All deletion operations are recorded with user email/ID
- Audit logs cannot be modified, providing immutable record
- Database constraints prevent orphaned records

## Future Enhancements

1. **Soft Deletes**: Implement soft delete with archive status for regulatory compliance
2. **Restore Functionality**: Allow undeleting recent deletions (with time limit)
3. **Batch Delete**: Support deleting multiple credit notes at once
4. **Delete Audit Report**: Generate detailed reports of deleted credit notes
5. **Permission Checks**: Add role-based permission checks for deletion
6. **Notification System**: Notify relevant users of credit note deletions
