import type { ModuleHelpContent } from '@/help/helpRegistry';

export type WorkOrderFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const workOrdersHelpIndex = [
  {
    title: 'Quick Start',
    items: [
      'Create a Work Order and select the Customer first.',
      'Attach the correct Unit to keep service history accurate.',
      'Add Parts and Labor lines as work is performed.',
      'Update Status as the job moves through the shop.',
      'Use Ready to Bill when totals are final, then invoice when approved.',
    ],
  },
  {
    title: 'Common Tasks',
    items: [
      'Change the Customer or Unit before invoicing if the job is mislinked.',
      'Add or correct parts quantities to match what was used.',
      'Add labor hours under the right Work Type for reporting.',
      'Review plasma lines for missing thickness or zero cut length.',
      'Mark Ready to Bill after a final totals review.',
      'Invoice only when the customer has approved the work.',
    ],
  },
  {
    title: 'FAQs',
    items: [
      'Why did totals change? Parts, labor, and plasma lines recalc totals immediately.',
      'Can QOH go negative? Yes—repairs should not be blocked by inventory timing.',
      'When do I use Ready to Bill? Use it after all work is complete and totals are final.',
      'Why is Status important? It drives shop visibility and reporting.',
      'What if plasma totals look wrong? Check thickness, cut length, and pierces first.',
    ],
  },
];

export const workOrdersFieldGuide: WorkOrderFieldGuideEntry[] = [
  {
    field: 'Customer',
    what: 'The account being billed for the work order.',
    when: 'Select before adding lines so billing and history are correct.',
    example: 'Great Plains Fleet',
    mistakes: 'Using the wrong customer or a walk-in when it should be billed.',
    impact: 'Controls billing, statements, and customer history.',
    keywords: ['customer', 'bill to', 'account'],
  },
  {
    field: 'Unit (optional)',
    what: 'The asset tied to the work order for service history.',
    when: 'Attach when the repair is for a specific unit or VIN.',
    example: 'Unit 12 - VIN 1FT...',
    mistakes: 'Skipping the unit and losing service history accuracy.',
    impact: 'Drives unit history and reporting.',
    keywords: ['unit', 'vin', 'asset'],
  },
  {
    field: 'Status',
    what: 'The workflow state of the work order.',
    when: 'Update intentionally as the job progresses.',
    example: 'Open → Completed → Invoiced',
    mistakes: 'Leaving a job in the wrong status and losing visibility.',
    impact: 'Affects dashboards, scheduling, and reporting.',
    keywords: ['status', 'workflow', 'open', 'completed', 'invoiced'],
  },
  {
    field: 'Ready to Bill',
    what: 'A signal that totals are final and the order is ready for invoicing.',
    when: 'Use after parts and labor are complete and totals look correct.',
    example: 'Checked after final review',
    mistakes: 'Marking ready before all lines are entered or approved.',
    impact: 'Flags billing readiness for the office team.',
    keywords: ['ready to bill', 'ready', 'billing ready'],
  },
  {
    field: 'Parts',
    what: 'Parts used on the work order; these reduce QOH.',
    when: 'Add parts as they are used on the repair.',
    example: '2 × BRK-001 Brake Pads',
    mistakes: 'Duplicating lines instead of editing quantities.',
    impact: 'Updates inventory, totals, and job costing.',
    keywords: ['parts', 'part line', 'qoh', 'inventory'],
  },
  {
    field: 'Labor',
    what: 'Labor lines for the work performed.',
    when: 'Add real hours under the closest Work Type.',
    example: '2.5 hrs Diagnostic',
    mistakes: 'Entering estimates instead of actual hours.',
    impact: 'Affects totals, margin, and technician reporting.',
    keywords: ['labor', 'hours', 'labor line'],
  },
  {
    field: 'Work Type',
    what: 'The labor category used for reporting and pricing rules.',
    when: 'Pick the closest match for accurate reporting.',
    example: 'Electrical',
    mistakes: 'Leaving blank or using the wrong category.',
    impact: 'Impacts reports, pricing rules, and labor analytics.',
    keywords: ['work type', 'labor type', 'category'],
  },
  {
    field: 'Labor Rate',
    what: 'The rate applied to labor hours (usually from settings).',
    when: 'Verify if totals look off.',
    example: '$145/hr',
    mistakes: 'Overriding without approval or misreading the rate.',
    impact: 'Directly affects labor totals and margins.',
    keywords: ['labor rate', 'rate', 'hourly rate'],
  },
  {
    field: 'Plasma Warnings',
    what: 'Flags missing or suspicious plasma values.',
    when: 'Review before posting or invoicing plasma jobs.',
    example: 'Missing thickness or zero cut length',
    mistakes: 'Ignoring warnings and invoicing incorrect totals.',
    impact: 'Prevents incorrect plasma pricing and reporting.',
    keywords: ['plasma warnings', 'warnings', 'flags'],
  },
  {
    field: 'Plasma Thickness',
    what: 'Material thickness for a plasma line.',
    when: 'Set for every plasma cut line.',
    example: '0.375 in',
    mistakes: 'Leaving blank or using the wrong unit.',
    impact: 'Affects cut speed and pricing.',
    keywords: ['thickness', 'material thickness', 'plasma thickness'],
  },
  {
    field: 'Plasma Quantity',
    what: 'How many pieces are being cut on the line.',
    when: 'Set to the number of identical parts being produced.',
    example: '12',
    mistakes: 'Leaving at 1 when producing multiples.',
    impact: 'Changes line total and cut time.',
    keywords: ['plasma quantity', 'qty', 'quantity'],
  },
  {
    field: 'Plasma Cut Length',
    what: 'Total inches of cut for the line.',
    when: 'Enter the true cut length for accurate time and pricing.',
    example: '248 in',
    mistakes: 'Entering 0 or using perimeter of a single piece when quantity > 1.',
    impact: 'Affects run time and cost.',
    keywords: ['cut length', 'plasma cut length', 'cut inches'],
  },
  {
    field: 'Plasma Pierces',
    what: 'The number of pierces (starts) on the line.',
    when: 'Set when pierces materially affect time and consumables.',
    example: '36',
    mistakes: 'Forgetting to multiply by quantity.',
    impact: 'Affects time and consumable usage.',
    keywords: ['pierces', 'plasma pierces', 'starts'],
  },
  {
    field: 'Plasma Setup Time',
    what: 'One-time setup time for the line.',
    when: 'Use for fixturing, program setup, and material handling.',
    example: '0.5 hrs',
    mistakes: 'Putting setup into run time and double-charging.',
    impact: 'Affects line amount and labor allocation.',
    keywords: ['setup time', 'plasma setup'],
  },
  {
    field: 'Plasma Run Time',
    what: 'Time spent cutting for the line.',
    when: 'Enter actual cut time or system-calculated time.',
    example: '1.25 hrs',
    mistakes: 'Leaving at zero or double-counting setup time.',
    impact: 'Drives plasma pricing and totals.',
    keywords: ['run time', 'cut time', 'plasma run time'],
  },
  {
    field: 'Plasma Line Amount',
    what: 'The sell amount for a plasma line.',
    when: 'Review after recalculation and override only when needed.',
    example: '$185.00',
    mistakes: 'Overriding without notes or missing a recalc.',
    impact: 'Affects totals, margin, and reporting.',
    keywords: ['line amount', 'plasma amount', 'line total'],
  },
  {
    field: 'Plasma Totals',
    what: 'Total sell amount for all plasma lines.',
    when: 'Review before invoicing plasma-heavy jobs.',
    example: '$1,425.00',
    mistakes: 'Assuming totals are correct without checking line inputs.',
    impact: 'Rolls into order totals and profitability.',
    keywords: ['plasma totals', 'plasma total', 'total plasma'],
  },
];

export const workOrdersHelpContent: ModuleHelpContent = {
  title: 'Work Orders',
  tips: workOrdersHelpIndex,
  workflows: [],
  definitions: workOrdersFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
