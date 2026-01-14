import type { ModuleHelpContent } from '../helpRegistry';

export const warrantyReturnsHelp: ModuleHelpContent = {
  title: 'Warranty & Returns',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Tie returns to the original sale/job when possible—keeps the paper trail clean.',
        'Restock only when the item is physically back and sellable.',
        "Use clear reasons and notes so credits don't become a mystery later.",
        "Warranty claims may cover parts, labor, or both—document what's approved.",
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a return',
      steps: [
        'Select customer',
        'Link to invoice/SO/WO (if available)',
        'Add return lines',
        'Choose reason/condition',
        'Save',
      ],
    },
    {
      title: 'Restock vs scrap',
      steps: [
        'Inspect item',
        'If sellable, restock to inventory',
        'If not, mark scrap/do not restock',
        'Add notes',
      ],
    },
    {
      title: 'Vendor return (RMA)',
      steps: [
        'Select vendor',
        'Enter RMA #',
        'Add items/qty',
        'Track status',
        'Save/print paperwork',
      ],
    },
    {
      title: 'Warranty claim',
      steps: [
        'Confirm eligibility',
        'Record approved amounts (parts/labor)',
        'Track claim status',
        'Finalize',
      ],
    },
  ],
  definitions: [
    {
      term: 'Return',
      meaning: 'Item coming back from the customer.',
    },
    {
      term: 'Warranty claim',
      meaning: 'Request for coverage due to defect/failure.',
    },
    {
      term: 'RMA',
      meaning: 'Return authorization number from a vendor.',
    },
    {
      term: 'Restock',
      meaning: 'Add back to QOH as sellable stock.',
    },
    {
      term: 'Scrap/Do not restock',
      meaning: 'Do not return it to sellable inventory.',
    },
  ],
};
