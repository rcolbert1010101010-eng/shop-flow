import type { ModuleHelpContent } from '../helpRegistry';

export const invoicesHelp: ModuleHelpContent = {
  title: 'Invoices',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Invoices are billing truth—treat sent/invoiced as locked.',
        'Confirm customer, dates, and totals before sending.',
        'Use clear line descriptions so approvals are easy.',
        'Payments reduce balance due. Avoid overpay.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create an invoice',
      steps: [
        'Open WO/SO',
        'Review totals',
        'Create invoice',
        'Verify customer + dates',
      ],
    },
    {
      title: 'Send/print an invoice',
      steps: [
        'Open invoice',
        'Print/PDF (or Send)',
        'Confirm the customer copy is correct',
      ],
    },
    {
      title: 'Fix a mistake',
      steps: [
        'Prefer correcting upstream lines (WO/SO) before invoicing',
        'If already invoiced, follow your shop policy (void/credit/reissue)',
      ],
    },
    {
      title: "Track what's unpaid",
      steps: [
        'Use invoice list filters',
        'Check balance due',
        'Follow up by aging',
      ],
    },
  ],
  definitions: [
    {
      term: 'Invoice',
      meaning: 'Billing document for a customer.',
    },
    {
      term: 'AR / Accounts Receivable',
      meaning: 'Money customers still owe.',
    },
    {
      term: 'Balance due',
      meaning: 'Total minus payments received.',
    },
    {
      term: 'Partial payment',
      meaning: 'Customer paid part of the invoice.',
    },
    {
      term: 'Void',
      meaning: 'Cancels an invoice while preserving history.',
    },
  ],
};
