import type { ModuleHelpContent } from '../helpRegistry';

export const customersHelp: ModuleHelpContent = {
  title: 'Customers',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Keep customer names, contacts, and billing info accurate.',
        'Pick the customer first when creating orders so history stays clean.',
        'Use customer notes for access rules, fleet preferences, and approvals.',
        'Link units to customers for complete service history.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a customer',
      steps: [
        'Click Add Customer',
        'Enter company name and contact info',
        'Set payment terms and tax settings',
        'Save',
      ],
    },
    {
      title: 'Link units to a customer',
      steps: [
        'Open customer detail',
        'Go to Units tab',
        'Add unit or link existing',
        'Units appear in customer history',
      ],
    },
  ],
  definitions: [
    {
      term: 'Customer',
      meaning: 'Company or person you do business with.',
    },
    {
      term: 'Primary Contact',
      meaning: 'Main person to call for approvals and updates.',
    },
    {
      term: 'Payment Terms',
      meaning: 'Controls due dates and aging (COD, Net 15, Net 30, etc.).',
    },
    {
      term: 'Credit Hold',
      meaning: 'Blocks new work when customer owes too much.',
    },
  ],
};
