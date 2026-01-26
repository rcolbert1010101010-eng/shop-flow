import type { ModuleHelpContent } from '@/help/helpRegistry';

export type InventoryFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const inventoryHelpIndex = [
  {
    title: 'Quick Start',
    items: [
      'Search for the part and review QOH, Cost, and Price.',
      'Use Adjust QOH for corrections with a required reason.',
      'Use Quick Cycle Count for fast on-hand verification.',
      'Apply price adjustments only when approved.',
      'Review recent adjustments for audit history.',
    ],
  },
  {
    title: 'Common Tasks',
    items: [
      'Adjust QOH after a verified count or scrap event.',
      'Set an adjustment reason to preserve audit trails.',
      'Compare Cost vs Price to catch margin issues.',
      'Review negative inventory and document why it happened.',
      'Run a quick cycle count and save only verified changes.',
    ],
  },
  {
    title: 'FAQs',
    items: [
      'Why is a reason required? Adjustments are audited and must be explainable.',
      'What is QOH? Quantity On Hand reflects physical inventory.',
      'How do Cost and Price differ? Cost is what you pay, Price is what you charge.',
      'Can inventory go negative? Yes, but document why and correct quickly.',
      'How does receiving affect inventory? Receiving increases QOH; use the Receiving module for PO workflows.',
    ],
  },
];

export const inventoryFieldGuide: InventoryFieldGuideEntry[] = [
  {
    field: 'Adjust QOH',
    what: 'Manual inventory adjustment to correct on-hand quantity.',
    when: 'Use after a verified count, scrap, or correction.',
    example: 'Set QOH from 12 to 10 after a cycle count.',
    mistakes: 'Adjusting without verification or using it instead of receiving.',
    impact: 'Updates inventory totals and audit history.',
    keywords: ['adjust qoh', 'adjust', 'qoh adjustment', 'inventory adjustment'],
  },
  {
    field: 'Adjustment Reason',
    what: 'Required reason for inventory changes.',
    when: 'Always select or enter a reason before saving.',
    example: 'Cycle Count',
    mistakes: 'Leaving it blank or using vague reasons like “fix”.',
    impact: 'Creates an audit trail for compliance and accountability.',
    keywords: ['reason', 'adjustment reason', 'audit'],
  },
  {
    field: 'QOH (On Hand)',
    what: 'Physical quantity on hand for the part.',
    when: 'Review before ordering or allocating inventory.',
    example: 'QOH: 6',
    mistakes: 'Assuming QOH equals available when items are reserved.',
    impact: 'Affects availability, reporting, and reordering decisions.',
    keywords: ['qoh', 'on hand', 'quantity on hand'],
  },
  {
    field: 'Available',
    what: 'Quantity available after allocations (if shown).',
    when: 'Use to decide if a part can be promised to a job.',
    example: 'Available: 2',
    mistakes: 'Ignoring reserved quantities and overcommitting parts.',
    impact: 'Prevents double-booking inventory.',
    keywords: ['available', 'availability'],
  },
  {
    field: 'Cost',
    what: 'What the shop pays per unit.',
    when: 'Review for valuation and margin checks.',
    example: '$42.50',
    mistakes: 'Confusing cost with selling price.',
    impact: 'Affects inventory valuation, margin, and reporting.',
    keywords: ['cost', 'unit cost', 'valuation'],
  },
  {
    field: 'Price',
    what: 'What the customer is charged per unit.',
    when: 'Adjust only with approval or pricing policy.',
    example: '$79.95',
    mistakes: 'Changing price without checking margin or policy.',
    impact: 'Affects revenue, margins, and quoting.',
    keywords: ['price', 'sell price', 'selling price'],
  },
  {
    field: 'Negative Inventory',
    what: 'QOH below zero when usage exceeds recorded stock.',
    when: 'Investigate and correct promptly.',
    example: 'QOH: -2 after emergency repair.',
    mistakes: 'Leaving negatives unresolved or adjusting without notes.',
    impact: 'Skews valuation, ordering, and reporting accuracy.',
    keywords: ['negative', 'negative inventory', 'below zero'],
  },
  {
    field: 'Receiving Impact',
    what: 'Receiving increases QOH and updates cost history.',
    when: 'Use to understand why QOH changed after deliveries.',
    example: 'Receiving 5 units increases QOH by 5.',
    mistakes: 'Using Adjust QOH instead of receiving for vendor deliveries.',
    impact: 'Affects audit trail and inventory valuation. For PO workflows, use Receiving.',
    keywords: ['receiving', 'receive', 'delivery'],
  },
  {
    field: 'Cycle Count',
    what: 'A focused count to reconcile physical and system inventory.',
    when: 'Use for periodic audits or discrepancies.',
    example: 'Quick Cycle Count on top movers.',
    mistakes: 'Skipping verification or counting without updating QOH.',
    impact: 'Improves inventory accuracy and audit readiness.',
    keywords: ['cycle count', 'count', 'audit'],
  },
  {
    field: 'Price Adjustment',
    what: 'Bulk or per-part price update (percent or flat).',
    when: 'Use for controlled price changes.',
    example: 'Increase price by 5%.',
    mistakes: 'Applying without review or to the wrong set of parts.',
    impact: 'Updates pricing across inventory and affects quoting.',
    keywords: ['price adjustment', 'adjust price', 'percent', 'flat'],
  },
];

export const inventoryHelpContent: ModuleHelpContent = {
  title: 'Inventory',
  tips: inventoryHelpIndex,
  workflows: [],
  definitions: inventoryFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
