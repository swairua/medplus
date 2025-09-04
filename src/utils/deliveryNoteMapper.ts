import { DeliveryNote } from '@/hooks/useDatabase';

// Maps database delivery_number to frontend delivery_note_number for compatibility
export const mapDeliveryNoteForDisplay = (deliveryNote: DeliveryNote & any) => {
  return {
    ...deliveryNote,
    delivery_note_number: deliveryNote.delivery_number || deliveryNote.delivery_note_number,
    invoice_number: deliveryNote.invoices?.invoice_number || deliveryNote.invoice_number,
  };
};

// Maps frontend delivery_note_number to database delivery_number for saving
export const mapDeliveryNoteForDatabase = (deliveryNote: any) => {
  const { delivery_note_number, ...rest } = deliveryNote;
  return {
    ...rest,
    delivery_number: delivery_note_number,
  };
};
