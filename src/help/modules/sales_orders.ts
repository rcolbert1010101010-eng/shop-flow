import type { ModuleHelpContent } from '../helpRegistry';

export const salesOrdersHelp: ModuleHelpContent = {
  title: 'Sales Orders',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Quotes are proposals. Orders are committed sales.',
        'Pick the customer first so billing and history stay clean.',
        'Use the correct UOM (ea/ft/in/sqft) so quantities mean what you think.',
        'Treat invoicing as a lock mindset—verify totals first.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a quote',
      steps: [
        'Select customer',
        'Add lines',
        'Review totals',
        'Print/Send',
      ],
    },
    {
      title: 'Convert quote to order',
      steps: [
        'Confirm quantities/prices',
        'Approve/Convert',
        'Set promise date',
        'Save',
      ],
    },
    {
      title: 'Invoice the sale',
      steps: [
        'Confirm totals',
        'Create invoice',
        'Collect payment (optional)',
        'Print/Send',
      ],
    },
  ],
  definitions: [
    {
      term: 'QOH',
      meaning: 'Quantity on hand in inventory.',
    },
    {
      term: 'UOM',
      meaning: 'Unit of measure (ea/ft/in/sqft).',
    },
    {
      term: 'Quote vs Order',
      meaning: 'Quote = proposal, Order = committed.',
    },
    {
      term: 'Balance due',
      meaning: "What's still unpaid.",
    },
  ],
};
