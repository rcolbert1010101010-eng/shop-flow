import type { ModuleHelpContent } from '../helpRegistry';

export const paymentsHelp: ModuleHelpContent = {
  title: 'Payments',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Record money exactly as received (method and amount).',
        'Partial payments are normal—balance due updates automatically.',
        'Avoid overpay. Apply to the correct invoice/order.',
        'Void a payment to reverse it while keeping an audit trail.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Receive a payment',
      steps: [
        'Choose customer',
        'Select invoice/order',
        'Enter amount',
        'Choose method',
        'Save',
      ],
    },
    {
      title: 'Record a partial',
      steps: [
        'Enter amount collected',
        'Save',
        'Balance due remains open',
      ],
    },
    {
      title: 'Fix a payment mistake',
      steps: [
        'Void the incorrect payment',
        'Re-enter the correct payment with notes',
      ],
    },
    {
      title: "Find what's still unpaid",
      steps: [
        'Filter by status',
        'Check balances',
        'Follow up by customer/invoice',
      ],
    },
  ],
  definitions: [
    {
      term: 'Payment',
      meaning: 'Money received from a customer.',
    },
    {
      term: 'Balance due',
      meaning: "What's still unpaid after payments.",
    },
    {
      term: 'Partial payment',
      meaning: 'Customer paid part of what they owe.',
    },
    {
      term: 'Void payment',
      meaning: 'Reverses a payment while preserving history.',
    },
    {
      term: 'Method',
      meaning: 'How they paid (card, cash, ACH, check).',
    },
  ],
};
