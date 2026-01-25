import type { ModuleHelpContent } from '@/help/helpRegistry';

export type PurchaseOrderFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const purchaseOrdersHelpIndex = [
  {
    title: 'Quick Start',
    items: [
      'Create a PO and pick the Vendor first (required).',
      'Add line items with correct quantities and unit costs.',
      'Receive items as they arrive (partial receiving is normal).',
      'Review costs for accuracy before closing.',
      'Close the PO when all lines are received and reconciled.',
    ],
  },
  {
    title: 'Common Tasks',
    items: [
      'Link the PO to a Sales Order or Work Order when applicable.',
      'Receive a partial shipment and leave remaining open.',
      'Adjust unit cost when the vendor invoice differs.',
      'Review receiving status to find outstanding items.',
      'Create returns/RMAs tied to the PO for credits or defects.',
      'Close the PO to lock quantities and costs once complete.',
    ],
  },
  {
    title: 'FAQs',
    items: [
      'Why do I need a vendor first? It controls pricing, lead time, and receiving context.',
      'What does Receiving Status mean? It reflects line-level received vs remaining.',
      'How does cost impact valuation? Unit cost updates affect inventory value and margins.',
      'When should I close a PO? After all items are received and costs are verified.',
      'How do returns work? Create a return/RMA linked to the PO to track credits.',
    ],
  },
];

export const purchaseOrdersFieldGuide: PurchaseOrderFieldGuideEntry[] = [
  {
    field: 'PO Number',
    what: 'The internal identifier for the purchase order.',
    when: 'Use for vendor communication and internal tracking.',
    example: 'PO-10452',
    mistakes: 'Changing it mid-process or using duplicate numbers.',
    impact: 'Used in searches, receiving, and audit trails.',
    keywords: ['po number', 'purchase order number', 'po #'],
  },
  {
    field: 'Vendor',
    what: 'The supplier you are ordering from (required).',
    when: 'Select first before adding lines.',
    example: 'Allied Parts Supply',
    mistakes: 'Adding lines before picking the vendor or choosing the wrong vendor.',
    impact: 'Drives pricing, receiving, and vendor reporting.',
    keywords: ['vendor', 'supplier'],
  },
  {
    field: 'Receiving Status',
    what: 'The PO status based on line receiving (Open, Partially Received, Received).',
    when: 'Use to find what is still outstanding.',
    example: 'Partially Received',
    mistakes: 'Assuming Received means the PO is closed.',
    impact: 'Drives operational visibility and follow-ups.',
    keywords: ['receiving status', 'status', 'open', 'partial', 'received'],
  },
  {
    field: 'Linked Sales Order',
    what: 'Optional link to the customer sale this PO supports.',
    when: 'Link when the PO is for a specific Sales Order.',
    example: 'SO-11024',
    mistakes: 'Leaving unlinked when the PO is customer-driven.',
    impact: 'Improves traceability and customer updates.',
    keywords: ['sales order', 'linked sales order', 'so'],
  },
  {
    field: 'Linked Work Order',
    what: 'Optional link to the repair job this PO supports.',
    when: 'Link when parts are ordered for a specific Work Order.',
    example: 'WO-20391',
    mistakes: 'Linking to the wrong job or leaving it blank.',
    impact: 'Improves job traceability and receiving accuracy.',
    keywords: ['work order', 'linked work order', 'wo'],
  },
  {
    field: 'Lock Status (Open/Closed)',
    what: 'Manual lock state for the PO.',
    when: 'Close once all items are received and costs are verified.',
    example: 'Closed',
    mistakes: 'Closing before final receiving or cost corrections.',
    impact: 'Locks the PO and prevents accidental changes.',
    keywords: ['closed', 'lock', 'locked', 'close'],
  },
  {
    field: 'Created Date',
    what: 'The date the PO was created.',
    when: 'Use for aging and vendor follow-up.',
    example: '01/24/2026',
    mistakes: 'Confusing created date with received date.',
    impact: 'Used in reporting and filtering.',
    keywords: ['created', 'created date', 'date created'],
  },
  {
    field: 'Part Number',
    what: 'The vendor or internal part number on the PO line.',
    when: 'Confirm it matches what will be received.',
    example: 'BRK-001',
    mistakes: 'Ordering the wrong part number or variant.',
    impact: 'Affects receiving accuracy and inventory matching.',
    keywords: ['part number', 'part #', 'sku'],
  },
  {
    field: 'Description',
    what: 'Human-readable description of the ordered item.',
    when: 'Use to verify the correct part or spec.',
    example: 'Brake Pad Set - Ceramic',
    mistakes: 'Leaving it blank or too generic.',
    impact: 'Shows on receiving and audit views.',
    keywords: ['description', 'item description'],
  },
  {
    field: 'Quantity Ordered',
    what: 'How many units are being ordered on the line.',
    when: 'Set based on vendor order quantity.',
    example: '12',
    mistakes: 'Ordering the wrong quantity or forgetting UOM changes.',
    impact: 'Controls receiving expectations and remaining count.',
    keywords: ['quantity ordered', 'qty ordered', 'ordered'],
  },
  {
    field: 'Quantity Received',
    what: 'How many units have been received so far.',
    when: 'Updates as items are received (partial is normal).',
    example: '6',
    mistakes: 'Receiving the full amount when only partial arrived.',
    impact: 'Drives receiving status and remaining quantity.',
    keywords: ['quantity received', 'received qty', 'received'],
  },
  {
    field: 'Remaining',
    what: 'Units still outstanding on the line.',
    when: 'Use to see what is still due from the vendor.',
    example: '6',
    mistakes: 'Ignoring remaining and closing too early.',
    impact: 'Affects open commitments and follow-up.',
    keywords: ['remaining', 'outstanding'],
  },
  {
    field: 'Unit Cost',
    what: 'Cost per unit on the PO line.',
    when: 'Verify against vendor invoice before closing.',
    example: '$42.50',
    mistakes: 'Leaving outdated costs or ignoring invoice changes.',
    impact: 'Affects inventory valuation, margins, and cost history.',
    keywords: ['unit cost', 'cost', 'valuation'],
  },
  {
    field: 'Receive Quantity',
    what: 'The quantity received in a receiving action.',
    when: 'Use for partial receiving as shipments arrive.',
    example: '3 received today',
    mistakes: 'Receiving the full order on a partial delivery.',
    impact: 'Updates receiving status and remaining counts.',
    keywords: ['receive quantity', 'partial receiving', 'receive'],
  },
  {
    field: 'In-Stock Filter',
    what: 'Shows only parts with QOH above zero while searching.',
    when: 'Use to avoid ordering items already in stock.',
    example: 'In-stock only enabled',
    mistakes: 'Leaving it on and missing out-of-stock parts.',
    impact: 'Changes search results during line creation.',
    keywords: ['in stock', 'filter', 'qoh'],
  },
  {
    field: 'Returns / RMAs',
    what: 'Returns tied to the PO for credits or defects.',
    when: 'Create when items are wrong, damaged, or credited.',
    example: 'RMA for 2 damaged rotors',
    mistakes: 'Tracking returns outside the PO and losing the audit trail.',
    impact: 'Keeps credits and vendor history accurate.',
    keywords: ['return', 'returns', 'rma', 'credit'],
  },
];

export const purchaseOrdersHelpContent: ModuleHelpContent = {
  title: 'Purchase Orders',
  tips: purchaseOrdersHelpIndex,
  workflows: [],
  definitions: purchaseOrdersFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
