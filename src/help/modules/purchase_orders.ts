import type { ModuleHelpContent } from '../helpRegistry';

export const purchaseOrdersHelp: ModuleHelpContent = {
  title: 'Purchase Orders',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Pick the vendor first. It keeps ordering and costs clean.',
        "Use partial receiving—don't force quantities to match the PO.",
        'Unit cost on PO lines drives margins and cost history.',
        'Close the PO only when receiving is complete.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a PO',
      steps: [
        'Select vendor',
        'Add parts/qty',
        'Confirm unit costs',
        'Save',
      ],
    },
    {
      title: 'Receive items',
      steps: [
        'Open PO',
        'Receive line(s)',
        'Enter qty received',
        'Verify QOH updated',
      ],
    },
    {
      title: 'Handle partials/backorders',
      steps: [
        'Receive what arrived',
        'Leave remaining open',
        'Follow up with vendor',
      ],
    },
    {
      title: 'Close the PO',
      steps: [
        'Verify remaining = 0',
        'Close PO',
        'Keep history intact',
      ],
    },
  ],
  definitions: [
    {
      term: 'PO',
      meaning: 'Vendor order used to buy inventory.',
    },
    {
      term: 'Ordered vs Received vs Remaining',
      meaning: 'Tracks how much is still outstanding.',
    },
    {
      term: 'Unit cost',
      meaning: 'Your cost per unit for this item.',
    },
    {
      term: 'Partial receiving',
      meaning: 'Receiving less than ordered (normal).',
    },
    {
      term: 'QOH',
      meaning: 'Quantity on hand in inventory.',
    },
  ],
};
