import type { ModuleHelpContent } from '../helpRegistry';

export const receivingHelp: ModuleHelpContent = {
  title: 'Receiving',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Receiving increases QOH and records cost.',
        'Use PO receiving when possible for the cleanest history.',
        'Partial receiving is normal—receive what arrived today.',
        'Use Adjust QOH for corrections, not receiving.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Receive against a PO',
      steps: [
        'Open PO',
        'Click Receive',
        'Enter qty received',
        'Post receipt',
      ],
    },
    {
      title: 'Direct receive (no PO)',
      steps: [
        'Choose vendor (if available)',
        'Add part lines',
        'Enter qty + unit cost',
        'Post receipt',
      ],
    },
    {
      title: 'Fix a receiving mistake',
      steps: [
        "Don't re-receive",
        'Use Adjust QOH with a reason',
        'Add a note explaining the correction',
      ],
    },
    {
      title: 'Receive sheet material',
      steps: [
        'Mark as sheet (if applicable)',
        'Enter width/length/thickness',
        'Post',
        'Track remnants later',
      ],
    },
  ],
  definitions: [
    {
      term: 'QOH',
      meaning: 'Quantity on hand in inventory.',
    },
    {
      term: 'Unit cost',
      meaning: 'Your cost per unit on this receipt.',
    },
    {
      term: 'Partial receiving',
      meaning: 'Receive less than ordered (normal).',
    },
    {
      term: 'Landed cost',
      meaning: 'Total cost including freight/fees (optional).',
    },
    {
      term: 'UOM',
      meaning: 'Unit of measure (ea/ft/in/sqft).',
    },
  ],
};
