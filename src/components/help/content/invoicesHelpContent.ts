import type { ModuleHelpContent } from '@/help/helpRegistry';

export type InvoicesFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const invoicesHelpIndex = [
  {
    title: 'Quick Start',
    items: [
      'Create an invoice from a Work Order or Sales Order.',
      'Review totals, tax, and customer info before finalizing.',
      'Finalize the invoice to lock it.',
      'Record payments (partial or full) as they arrive.',
      'Use credits/returns for corrections instead of editing.',
    ],
  },
  {
    title: 'Common Workflows',
    items: [
      'Finalize an invoice once the customer approves the total.',
      'Record a partial payment and leave the balance due.',
      'Issue a credit for corrections or returns.',
      'Reprint or resend the invoice after finalization.',
      'Review invoice status before exporting to accounting.',
    ],
  },
  {
    title: 'FAQs',
    items: [
      'Why is the invoice locked? Finalized invoices are immutable for audit accuracy.',
      'How do I fix a mistake? Issue a credit/return and create a new invoice if needed.',
      'Can I take partial payments? Yes—balance due updates automatically.',
      'What happens to the source order? WO/SO becomes read-only after invoicing.',
      'What about accounting exports? Finalized invoices are the source for exports.',
    ],
  },
];

export const invoicesFieldGuide: InvoicesFieldGuideEntry[] = [
  {
    field: 'Invoice Lifecycle (Draft → Final → Paid)',
    what: 'The status flow from draft creation to finalization and payment.',
    when: 'Use to track where the invoice is in the billing process.',
    example: 'Draft → Final → Paid',
    mistakes: 'Treating a draft as final or forgetting to finalize before export.',
    impact: 'Controls locking, visibility, and accounting readiness.',
    keywords: ['invoice lifecycle', 'draft', 'final', 'paid', 'status'],
  },
  {
    field: 'Invoice Locking (Immutability)',
    what: 'Final invoices cannot be edited to preserve audit integrity.',
    when: 'Applies immediately after finalization.',
    example: 'Locked after finalization',
    mistakes: 'Attempting to edit instead of issuing a credit.',
    impact: 'Prevents changes to totals, taxes, and line items.',
    keywords: ['locked', 'immutable', 'finalized', 'edit invoice'],
  },
  {
    field: 'Payments',
    what: 'Funds received against an invoice.',
    when: 'Record each payment as it is received.',
    example: 'Partial payment of $200 applied',
    mistakes: 'Recording the wrong amount or method.',
    impact: 'Updates balance due and payment history.',
    keywords: ['payment', 'payments', 'partial payment', 'balance due'],
  },
  {
    field: 'Credits / Corrections',
    what: 'Adjustments applied via credits or returns.',
    when: 'Use when correcting a finalized invoice.',
    example: 'Credit memo for returned part',
    mistakes: 'Editing the original invoice after finalization.',
    impact: 'Maintains audit trail and accounting accuracy.',
    keywords: ['credit', 'credit memo', 'return', 'correction'],
  },
  {
    field: 'Source Order Relationship',
    what: 'Invoices are generated from Work Orders or Sales Orders.',
    when: 'Use to verify the source and confirm read-only state after invoicing.',
    example: 'Invoice created from WO-12345',
    mistakes: 'Expecting to edit the source order after invoicing.',
    impact: 'WO/SO become read-only to preserve financial integrity.',
    keywords: ['work order', 'sales order', 'source', 'read-only'],
  },
  {
    field: 'Accounting Export Implications',
    what: 'Finalized invoices feed accounting exports.',
    when: 'Review before exporting or syncing accounting.',
    example: 'Final invoice exported in monthly batch',
    mistakes: 'Exporting drafts or unapproved totals.',
    impact: 'Affects financial statements and reconciliation accuracy.',
    keywords: ['export', 'accounting', 'sync', 'reconciliation'],
  },
];

export const invoicesHelpContent: ModuleHelpContent = {
  title: 'Invoices',
  tips: invoicesHelpIndex,
  workflows: [],
  definitions: invoicesFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
