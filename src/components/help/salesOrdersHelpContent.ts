import type { ModuleHelpContent } from '@/help/helpRegistry';

export type SalesOrderFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const salesOrdersHelpIndex = [
  {
    title: 'Quick Start',
    items: [
      'Create a new Sales Order and confirm the status (Estimate or Open).',
      'Select the Customer and attach a Unit if the sale ties to an asset.',
      'Add parts with the correct quantities and unit prices.',
      'Review tax and totals, then add discounts/fees if your shop uses them.',
      'Record payment or invoice to close the sale when ready.',
    ],
  },
  {
    title: 'Common Tasks',
    items: [
      'Change the Customer before invoicing if the sale is assigned incorrectly.',
      'Attach or remove a Unit to keep asset history clean.',
      'Add or remove line items and adjust quantities.',
      'Override a price with a clear audit note in Internal Notes.',
      'Record partial payments and monitor Balance Due.',
      'Review payment history before closing the order.',
    ],
  },
  {
    title: 'FAQs',
    items: [
      'What is the order number? It is system-generated for tracking and customer references.',
      'What is the status flow? Estimates become Open, then Partial/Invoiced/Completed, or Cancelled.',
      'When do totals update? Totals recalc after line edits, tax changes, or price overrides.',
      'Why do prices differ? Price level, tax settings, and overrides can change line pricing.',
      'How does tax work? Tax is applied to taxable lines at the order tax rate.',
      'What are Internal Notes for? Staff-only context; keep customer-facing text out unless you intend to print it.',
    ],
  },
];

export const salesOrdersFieldGuide: SalesOrderFieldGuideEntry[] = [
  {
    field: 'Order Number',
    what: 'The system-generated identifier for the sales order.',
    when: 'Use it when searching, quoting, or referencing the order with a customer.',
    example: 'SO-100245',
    mistakes: 'Typing a manual number or confusing it with an invoice number.',
    impact: 'Appears on the list, detail view, printouts, and exports.',
    keywords: ['order number', 'sales order number', 'so number'],
  },
  {
    field: 'Customer',
    what: 'The account being billed for the sale.',
    when: 'Select before adding lines so pricing and tax default correctly.',
    example: 'Northstar Logistics, Inc.',
    mistakes: 'Using a walk-in customer when the account should be billed.',
    impact: 'Drives pricing level, tax status, statements, and order history.',
    keywords: ['customer', 'account', 'bill to'],
  },
  {
    field: 'Status',
    what: 'Where the sale is in the workflow (Estimate, Open, Partial, Invoiced, Completed, Cancelled).',
    when: 'Update as the sale progresses to keep reporting accurate.',
    example: 'Open',
    mistakes: 'Leaving an order in Estimate after parts are delivered.',
    impact: 'Controls visibility in lists, billing, and operational reporting.',
    keywords: ['status', 'estimate', 'open', 'partial', 'invoiced', 'completed', 'cancelled'],
  },
  {
    field: 'Total',
    what: 'The overall order total shown in the list view.',
    when: 'Use for quick comparisons and filtering.',
    example: '$842.19',
    mistakes: 'Assuming it reflects payments; it is the gross total.',
    impact: 'Displays in list views and summaries.',
    keywords: ['total', 'order total', 'list total'],
  },
  {
    field: 'Created',
    what: 'The date the sales order was created.',
    when: 'Use for aging, tracking, and follow-ups.',
    example: '01/24/2026',
    mistakes: 'Mistaking created date for invoiced date.',
    impact: 'Used in list filtering and reporting.',
    keywords: ['created', 'created at', 'date created'],
  },
  {
    field: 'Unit (optional)',
    what: 'The asset tied to this sale for history and service context.',
    when: 'Attach when parts are sold for a specific unit or VIN.',
    example: 'Unit 42 - Ford F-550',
    mistakes: 'Leaving blank when the sale should be linked to a unit.',
    impact: 'Links sales to unit history and reporting.',
    keywords: ['unit', 'attach unit', 'asset', 'vin'],
  },
  {
    field: 'Invoiced At',
    what: 'The timestamp when the order was invoiced and locked.',
    when: 'Use to verify billing and audit timing.',
    example: '01/24/2026 2:41 PM',
    mistakes: 'Assuming edits are allowed after invoicing.',
    impact: 'Locks pricing and affects invoice records and reports.',
    keywords: ['invoiced at', 'invoice date', 'invoiced time'],
  },
  {
    field: 'Internal Notes',
    what: 'Notes for staff context and approvals on the sales order.',
    when: 'Use for substitutions, approvals, or internal handling instructions.',
    example: 'Customer approved alternate brand. Keep cores for pickup.',
    mistakes: 'Storing sensitive data or customer-facing language you do not want printed.',
    impact: 'Visible on the order and may print under Notes/Terms depending on layout.',
    keywords: ['internal notes', 'notes', 'order notes'],
  },
  {
    field: 'Part Number',
    what: 'The exact part identifier for the line item.',
    when: 'Use when selecting or verifying parts before adding lines.',
    example: 'BRK-001',
    mistakes: 'Using a similar number that points to the wrong part or UOM.',
    impact: 'Controls inventory linkage, pricing defaults, and reporting.',
    keywords: ['part number', 'part #', 'sku'],
  },
  {
    field: 'Description',
    what: 'Human-readable description of the part or item.',
    when: 'Use to confirm the part and clarify specs if needed.',
    example: 'Brake Pad Set - Ceramic',
    mistakes: 'Leaving blank or using ambiguous short labels.',
    impact: 'Shows on the order, printouts, and exports.',
    keywords: ['description', 'item description'],
  },
  {
    field: 'Quantity',
    what: 'How many units of the part are being sold.',
    when: 'Set to match the actual quantity delivered or quoted.',
    example: '2',
    mistakes: 'Using the wrong unit of measure or leaving default quantity.',
    impact: 'Drives line total, inventory impact, and order totals.',
    keywords: ['quantity', 'qty', 'quantity sold'],
  },
  {
    field: 'Unit Price',
    what: 'The sell price per unit for the line.',
    when: 'Adjust only with a clear reason and audit note if needed.',
    example: '$129.95',
    mistakes: 'Overriding without approval or forgetting to update totals.',
    impact: 'Directly affects line total, margin, and overall totals.',
    keywords: ['unit price', 'price', 'sell price'],
  },
  {
    field: 'Line Total',
    what: 'The total amount for a line item after quantity and pricing.',
    when: 'Review for accuracy before invoicing.',
    example: '$259.90',
    mistakes: 'Assuming it updates after overrides without saving.',
    impact: 'Rolls up into order subtotal, tax, and total due.',
    keywords: ['line total', 'line amount', 'line subtotal'],
  },
  {
    field: 'Total Due',
    what: 'The final amount due before payments.',
    when: 'Review before recording payments or invoicing.',
    example: '$842.19',
    mistakes: 'Confusing it with Balance Due after payments.',
    impact: 'Used for invoicing, customer totals, and printouts.',
    keywords: ['total due', 'final total', 'order total due'],
  },
  {
    field: 'Balance Due',
    what: 'What remains unpaid after payments are applied.',
    when: 'Use to confirm whether the order can be closed or needs follow-up.',
    example: '$150.00',
    mistakes: 'Assuming balance due matches total when payments exist.',
    impact: 'Shown in payment summaries and drives collections follow-up.',
    keywords: ['balance due', 'balance', 'amount due'],
  },
  {
    field: 'Payments (Record Payment)',
    what: 'The section used to record payments against the order.',
    when: 'Use for partial or full payments as they are received.',
    example: 'Card payment $300.00 with last 4 digits noted.',
    mistakes: 'Forgetting to add a reference or recording the wrong method.',
    impact: 'Updates balance due and payment history, and appears on invoices.',
    keywords: ['payments', 'record payment', 'payment method', 'payment reference'],
  },
];

export const salesOrdersHelpContent: ModuleHelpContent = {
  title: 'Sales Orders',
  tips: salesOrdersHelpIndex,
  workflows: [],
  definitions: salesOrdersFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
