import type { ModuleHelpContent } from '../helpRegistry';

export const workOrdersHelp: ModuleHelpContent = {
  title: 'Work Orders',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Pick customer and unit first so history stays clean.',
        'Labor and parts are tracked separately—keep line items accurate.',
        "Parts on a WO affect inventory. Negative stock may be allowed—don't block the repair.",
        'Treat invoicing as a lock mindset—verify totals and notes first.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a work order',
      steps: [
        'Select customer',
        'Select unit',
        'Add concern/notes',
        'Save',
      ],
    },
    {
      title: 'Add labor',
      steps: [
        'Open Labor tab',
        'Add work type',
        'Enter hours',
        'Add notes (if needed)',
      ],
    },
    {
      title: 'Add parts',
      steps: [
        'Open Parts tab',
        'Select part',
        'Enter qty (correct UOM)',
        'Save line',
      ],
    },
    {
      title: 'Close out and invoice',
      steps: [
        'Review totals',
        'Confirm labor/parts lines',
        'Invoice',
        'Print/Send',
      ],
    },
  ],
  definitions: [
    {
      term: 'WO',
      meaning: 'Job record for repair work.',
    },
    {
      term: 'Concern vs Notes',
      meaning: 'Concern = problem; Notes = what you found/did.',
    },
    {
      term: 'UOM',
      meaning: 'Unit of measure (ea/ft/in/sqft).',
    },
    {
      term: 'QOH',
      meaning: 'Quantity on hand in inventory.',
    },
    {
      term: 'Invoice',
      meaning: 'Billing document created from the WO.',
    },
    {
      term: 'Balance due',
      meaning: "What's still unpaid.",
    },
  ],
};
