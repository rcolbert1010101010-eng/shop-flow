import type { ModuleHelpContent } from '../helpRegistry';

export const partsHelp: ModuleHelpContent = {
  title: 'Parts Management',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Part numbers should be unique and stable - avoid changing them after creation.',
        'Set accurate cost and selling price for margin calculations.',
        'Use categories to organize parts for easier browsing.',
        'Link parts to vendors for purchase order workflows.',
        'Track core charges if parts require core returns.',
        'Use UOM (EA/FT/SQFT) to match how you actually measure and sell the part.',
        'For sheet materials, set dimensions to enable "receive by sheets" conversion.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a New Part',
      steps: [
        'Navigate to Inventory and click "New Part" or go to /inventory/new.',
        'Enter part number (required, must be unique).',
        'Fill in description, vendor, category, cost, and selling price.',
        'Set UOM if not EA (each).',
        'For sheet materials, select Material Type = SHEET and enter dimensions.',
        'Set initial QOH if needed (creates an audit-safe adjustment).',
        'Save the part.',
        'The part appears in Inventory and can be used in orders.',
      ],
    },
    {
      title: 'Create a Remnant from Sheet Material',
      steps: [
        'Open a sheet material part (material_kind = SHEET, uom = SQFT).',
        'Click "Create Remnant" button.',
        'Enter remnant width and length (in inches).',
        'Optionally subtract used SQFT from parent sheet.',
        'Confirm creation.',
        'The remnant is created as a new part linked to the parent.',
        'Both parts show the relationship in their detail views.',
      ],
    },
    {
      title: 'Update Part Pricing',
      steps: [
        'Open the part detail page.',
        'Click Edit.',
        'Update cost or selling price.',
        'Save changes.',
        'New pricing applies to future sales orders and work orders.',
        'Historical pricing is preserved in cost history.',
      ],
    },
  ],
  definitions: [
    {
      term: 'Part Number',
      meaning: 'Unique identifier for the part. Used in searches, orders, and inventory tracking.',
    },
    {
      term: 'Core Charge',
      meaning: 'Additional fee charged when a part requires a core return (e.g., alternators, starters).',
    },
    {
      term: 'UOM',
      meaning: 'Unit of Measure - EA (each), FT (feet), or SQFT (square feet). Determines how quantities are tracked.',
    },
    {
      term: 'Material Kind',
      meaning: 'STANDARD for regular parts, SHEET for sheet materials tracked by area (SQFT).',
    },
    {
      term: 'Remnant',
      meaning: 'A leftover piece of sheet material after cutting. Tracked separately but linked to parent sheet.',
    },
    {
      term: 'Initial QOH',
      meaning: 'Starting quantity when creating a new part. Creates an audit-safe "Initial Stock" adjustment.',
    },
  ],
};
