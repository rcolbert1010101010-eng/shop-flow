import type { ModuleHelpContent } from '../helpRegistry';

export const inventoryHelp: ModuleHelpContent = {
  title: 'Inventory Management',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Use the search bar to quickly find parts by number, description, or vendor.',
        'Filter by stock status (All, Low, Out) to focus on what needs attention.',
        'Adjust QOH directly from the list for quick cycle counts.',
        'Import parts in bulk using the Import button and CSV template.',
        'Track movements in Recent Activity to see all inventory changes.',
        'Set min/max quantities to get alerts when stock is low.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Receive Inventory',
      steps: [
        'Navigate to Receiving page from the main menu.',
        'Select or create a Purchase Order.',
        'Enter quantities received for each line item.',
        'Review and confirm the receiving transaction.',
        'QOH updates automatically and movements are recorded.',
      ],
    },
    {
      title: 'Adjust Quantity on Hand',
      steps: [
        'Find the part in the Inventory list.',
        'Click the Adjust QOH button (or use the action menu).',
        'Enter the new quantity or adjustment amount.',
        'Select a reason (Cycle Count, Scrap, etc.).',
        'Confirm the adjustment.',
        'The change is recorded in Recent Activity.',
      ],
    },
    {
      title: 'Import Parts from CSV',
      steps: [
        'Click the Import button on the Inventory page.',
        'Download the Excel template if needed.',
        'Fill in your parts data (part number, description, cost, etc.).',
        'Paste or upload the CSV file.',
        'Review the preview table for errors.',
        'Confirm the import.',
        'Check Import History for results.',
      ],
    },
  ],
  definitions: [
    {
      term: 'QOH',
      meaning: 'Quantity on Hand - the current physical stock count for a part.',
    },
    {
      term: 'Bin Location',
      meaning: 'Physical location where the part is stored (shelf, bin number, etc.).',
    },
    {
      term: 'Min/Max',
      meaning: 'Minimum and maximum stock levels. Alerts trigger when QOH falls below min.',
    },
    {
      term: 'Cycle Count',
      meaning: 'Physical inventory count to verify and correct QOH discrepancies.',
    },
    {
      term: 'Inventory Movement',
      meaning: 'Any change to QOH (receiving, adjustment, sale, etc.) recorded for audit trail.',
    },
    {
      term: 'UOM',
      meaning: 'Unit of Measure - how the part is tracked (EA = each, FT = feet, SQFT = square feet).',
    },
  ],
};
