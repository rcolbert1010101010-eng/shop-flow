export interface HelpContext {
  // Generic flag for empty/blank states on a screen
  isEmpty?: boolean;
  // Record type (e.g., 'sales_order', 'work_order', 'invoice')
  recordType?: string;
  // Record status (e.g., 'INVOICED', 'DRAFT', 'COMPLETED')
  status?: string;
  // Whether the record has an associated customer
  hasCustomer?: boolean;
  // Whether the record has line items
  hasLines?: boolean;
}

