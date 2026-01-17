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
  // User role used for role-aware help rendering (mapped to help roles)
  userRole?: HelpRole;
  // Canonical auto-help triggers detected for this screen/action
  autoTriggers?: AutoHelpTrigger[];
  // Optional hints for locked/disabled states
  lockedReason?: string;
  // Optional flag when user hesitates (hover/repeat attempts)
  hesitation?: boolean;
  // Optional label for the action being attempted (e.g., "Invoice", "Receive")
  actionName?: string;
}

export type HelpRole = 'Technician' | 'Service Writer' | 'Manager/Admin';

export type AutoHelpTrigger =
  | 'high_risk_transition'
  | 'locked_action'
  | 'inventory_impact'
  | 'hesitation';
