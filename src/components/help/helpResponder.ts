import type { ModuleHelpContent } from '@/help/helpRegistry';
import { getModuleHelp } from '@/help/helpRegistry';
import type { HelpContext, HelpRole } from '@/help/types';
import { logHelpInteraction } from './helpAudit';
import { customersFieldGuide } from './customersHelpContent';
import { salesOrdersFieldGuide } from './salesOrdersHelpContent';
import { workOrdersFieldGuide } from './workOrdersHelpContent';
import { purchaseOrdersFieldGuide } from './content/purchaseOrdersHelpContent';
import { inventoryFieldGuide } from './content/inventoryHelpContent';
import { schedulingFieldGuide } from './content/schedulingHelpContent';

interface Response {
  answer: string;
  suggestions: string[];
}

const billingKeywords = ['invoice', 'billing', 'payment', 'balance', 'void', 'price', 'cost'];
const adminKeywords = [
  'invoice',
  'billing',
  'payment',
  'balance',
  'void',
  'price',
  'cost',
  'margin',
  'inventory',
  'qoh',
  'stock',
  'audit',
  'lock',
  'financial',
  'receive',
];

function resolveHelpRole(context?: HelpContext): HelpRole {
  const role = context?.userRole;
  if (role === 'Manager/Admin' || role === 'Service Writer' || role === 'Technician') {
    return role;
  }
  return 'Technician';
}

function renderingModeForRole(role: HelpRole): 'technician' | 'service_writer' | 'manager_admin' {
  if (role === 'Service Writer') return 'service_writer';
  if (role === 'Manager/Admin') return 'manager_admin';
  return 'technician';
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((k) => normalized.includes(k));
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function isCustomerFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return customersFieldGuide.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function findCustomerFieldGuideEntry(text: string) {
  const normalized = normalizeText(text);
  return (
    customersFieldGuide.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

function buildCustomerFieldAnswer(entry: {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
}): string {
  return [
    `**${entry.field}**`,
    `What it is: ${entry.what}`,
    `When to use: ${entry.when}`,
    `Example: ${entry.example}`,
    `Common mistakes: ${entry.mistakes}`,
    `Downstream impact: ${entry.impact}`,
  ].join('\n');
}

function detectCustomerCrossModule(text: string): { label: string } | null {
  const normalized = normalizeText(text);
  const matches = [
    { label: 'Work Orders', keywords: ['work order', 'work orders', 'workorder'] },
    { label: 'Sales Orders', keywords: ['sales order', 'sales orders', 'salesorder'] },
    { label: 'Inventory', keywords: ['inventory', 'qoh', 'stock'] },
    { label: 'Purchase Orders', keywords: ['purchase order', 'purchase orders', 'po number'] },
    { label: 'Receiving', keywords: ['receiving', 'receive shipment'] },
    { label: 'Scheduling', keywords: ['schedule', 'scheduling', 'calendar'] },
    { label: 'Invoices', keywords: ['invoice', 'invoices', 'invoicing'] },
    { label: 'Payments', keywords: ['payment', 'payments', 'void payment'] },
    { label: 'Settings', keywords: ['settings', 'setup', 'configuration'] },
  ];

  for (const match of matches) {
    if (match.keywords.some((keyword) => normalized.includes(keyword))) {
      return { label: match.label };
    }
  }

  return null;
}

function isSalesOrdersFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return salesOrdersFieldGuide.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function findSalesOrdersFieldGuideEntry(text: string) {
  const normalized = normalizeText(text);
  return (
    salesOrdersFieldGuide.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

function buildSalesOrdersFieldAnswer(entry: {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
}): string {
  return [
    `**${entry.field}**`,
    `What it is: ${entry.what}`,
    `When to use: ${entry.when}`,
    `Example: ${entry.example}`,
    `Common mistakes: ${entry.mistakes}`,
    `Downstream impact: ${entry.impact}`,
  ].join('\n');
}

function detectSalesOrdersCrossModule(text: string): { label: string } | null {
  const normalized = normalizeText(text);
  const matches = [
    { label: 'Work Orders', keywords: ['work order', 'work orders', 'workorder'] },
    { label: 'Inventory', keywords: ['inventory', 'qoh', 'stock', 'cycle count'] },
    { label: 'Purchase Orders', keywords: ['purchase order', 'purchase orders', 'po number'] },
    { label: 'Receiving', keywords: ['receiving', 'receive shipment'] },
    { label: 'Scheduling', keywords: ['schedule', 'scheduling', 'calendar'] },
    { label: 'Payments', keywords: ['payment history', 'void payment'] },
    { label: 'Settings', keywords: ['settings', 'setup', 'configuration'] },
  ];

  for (const match of matches) {
    if (match.keywords.some((keyword) => normalized.includes(keyword))) {
      return { label: match.label };
    }
  }

  return null;
}

function isWorkOrdersFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return workOrdersFieldGuide.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function findWorkOrdersFieldGuideEntry(text: string) {
  const normalized = normalizeText(text);
  return (
    workOrdersFieldGuide.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

function buildWorkOrdersFieldAnswer(entry: {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
}): string {
  return [
    `**${entry.field}**`,
    `What it is: ${entry.what}`,
    `When to use: ${entry.when}`,
    `Example: ${entry.example}`,
    `Common mistakes: ${entry.mistakes}`,
    `Downstream impact: ${entry.impact}`,
  ].join('\n');
}

function detectWorkOrdersCrossModule(text: string): { label: string } | null {
  const normalized = normalizeText(text);
  const matches = [
    { label: 'Sales Orders', keywords: ['sales order', 'sales orders', 'salesorder'] },
    { label: 'Inventory', keywords: ['inventory', 'qoh', 'stock', 'cycle count'] },
    { label: 'Purchase Orders', keywords: ['purchase order', 'purchase orders', 'po number'] },
    { label: 'Receiving', keywords: ['receiving', 'receive shipment'] },
    { label: 'Scheduling', keywords: ['schedule', 'scheduling', 'calendar'] },
    { label: 'Payments', keywords: ['payment history', 'void payment'] },
    { label: 'Settings', keywords: ['settings', 'setup', 'configuration'] },
  ];

  for (const match of matches) {
    if (match.keywords.some((keyword) => normalized.includes(keyword))) {
      return { label: match.label };
    }
  }

  return null;
}

function isPurchaseOrdersFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return purchaseOrdersFieldGuide.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function findPurchaseOrdersFieldGuideEntry(text: string) {
  const normalized = normalizeText(text);
  return (
    purchaseOrdersFieldGuide.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

function buildPurchaseOrdersFieldAnswer(entry: {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
}): string {
  return [
    `**${entry.field}**`,
    `What it is: ${entry.what}`,
    `When to use: ${entry.when}`,
    `Example: ${entry.example}`,
    `Common mistakes: ${entry.mistakes}`,
    `Downstream impact: ${entry.impact}`,
  ].join('\n');
}

function detectPurchaseOrdersCrossModule(text: string): { label: string } | null {
  const normalized = normalizeText(text);
  const matches = [
    { label: 'Work Orders', keywords: ['work order', 'work orders', 'workorder'] },
    { label: 'Sales Orders', keywords: ['sales order', 'sales orders', 'salesorder'] },
    { label: 'Inventory', keywords: ['inventory', 'qoh', 'stock', 'cycle count'] },
    { label: 'Receiving', keywords: ['receiving', 'receive shipment'] },
    { label: 'Payments', keywords: ['payment history', 'void payment'] },
    { label: 'Settings', keywords: ['settings', 'setup', 'configuration'] },
  ];

  for (const match of matches) {
    if (match.keywords.some((keyword) => normalized.includes(keyword))) {
      return { label: match.label };
    }
  }

  return null;
}

function isInventoryFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return inventoryFieldGuide.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function findInventoryFieldGuideEntry(text: string) {
  const normalized = normalizeText(text);
  return (
    inventoryFieldGuide.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

function buildInventoryFieldAnswer(entry: {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
}): string {
  return [
    `**${entry.field}**`,
    `What it is: ${entry.what}`,
    `When to use: ${entry.when}`,
    `Example: ${entry.example}`,
    `Common mistakes: ${entry.mistakes}`,
    `Downstream impact: ${entry.impact}`,
  ].join('\n');
}

function detectInventoryCrossModule(text: string): { label: string } | null {
  const normalized = normalizeText(text);
  const matches = [
    { label: 'Purchase Orders', keywords: ['purchase order', 'purchase orders', 'po number'] },
    { label: 'Receiving', keywords: ['receiving', 'receive shipment'] },
    { label: 'Work Orders', keywords: ['work order', 'work orders', 'workorder'] },
    { label: 'Sales Orders', keywords: ['sales order', 'sales orders', 'salesorder'] },
    { label: 'Payments', keywords: ['payment history', 'void payment'] },
    { label: 'Settings', keywords: ['settings', 'setup', 'configuration'] },
  ];

  for (const match of matches) {
    if (match.keywords.some((keyword) => normalized.includes(keyword))) {
      return { label: match.label };
    }
  }

  return null;
}

function isSchedulingFieldQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return schedulingFieldGuide.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function findSchedulingFieldGuideEntry(text: string) {
  const normalized = normalizeText(text);
  return (
    schedulingFieldGuide.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

function buildSchedulingFieldAnswer(entry: {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
}): string {
  return [
    `**${entry.field}**`,
    `What it is: ${entry.what}`,
    `When to use: ${entry.when}`,
    `Example: ${entry.example}`,
    `Common mistakes: ${entry.mistakes}`,
    `Downstream impact: ${entry.impact}`,
  ].join('\n');
}

function detectSchedulingCrossModule(text: string): { label: string } | null {
  const normalized = normalizeText(text);
  const matches = [
    { label: 'Work Orders', keywords: ['work order', 'work orders', 'workorder'] },
    { label: 'Sales Orders', keywords: ['sales order', 'sales orders', 'salesorder'] },
    { label: 'Inventory', keywords: ['inventory', 'qoh', 'stock'] },
    { label: 'Purchase Orders', keywords: ['purchase order', 'purchase orders', 'po number'] },
    { label: 'Receiving', keywords: ['receiving', 'receive shipment'] },
    { label: 'Payments', keywords: ['payment history', 'void payment'] },
    { label: 'Settings', keywords: ['settings', 'setup', 'configuration'] },
  ];

  for (const match of matches) {
    if (match.keywords.some((keyword) => normalized.includes(keyword))) {
      return { label: match.label };
    }
  }

  return null;
}

function countMatches(text: string, searchTerms: string[]): number {
  const normalized = normalizeText(text);
  return searchTerms.filter((term) => normalized.includes(term)).length;
}

function isExplainQuestion(text: string): boolean {
  const cleaned = normalizeText(text).replace(/[?.!]/g, '');
  return (
    cleaned === 'explain this screen' ||
    cleaned === 'what is this screen for' ||
    cleaned === 'what does this screen do'
  );
}
function buildExplainAnswer(moduleKey: string, fallbackContent: ModuleHelpContent, context?: HelpContext): string {
  const moduleContent = getModuleHelp(moduleKey) ?? fallbackContent;
  const title = moduleContent.title;

  const workflows = moduleContent.workflows.slice(0, 3).map((w) => w.title);
  const tips: string[] = [];
  moduleContent.tips.forEach((group) => {
    group.items.forEach((item) => {
      if (tips.length < 2) tips.push(item);
    });
  });

  const lines: string[] = [];

  // What this screen is for
  lines.push('**What this screen is for**');
  lines.push(`This screen is for managing ${title.toLowerCase()} in your shop.`);

  // What to do first
  lines.push('\n**What to do first**');
  if (context?.status === 'INVOICED') {
    lines.push('This record is invoiced, so most fields are locked. Use view/print/notes or create a new transaction to correct issues.');
  } else if (moduleKey === 'payments' && context?.isEmpty) {
    lines.push('Right now this screen is empty because no payments have been recorded yet. Start by using "Receive Payment" to record your first payment. Once payments exist, you can review history, filter by date/method, and audit balances here.');
  } else {
    lines.push('Start by confirming the customer/unit and reviewing the key details at the top.');
  }

  // Common mistakes
  lines.push('\n**Common mistakes**');
  if (tips.length > 0) {
    tips.forEach((t) => lines.push(`• ${t}`));
  } else {
    lines.push('• Skipping required info and having to backtrack later.');
  }

  // What should happen next
  lines.push('\n**What should happen next**');
  if (workflows.length > 0) {
    lines.push("Next, you'll usually:");
    workflows.forEach((w) => lines.push(`• ${w}`));
  } else {
    lines.push('Add your first line item, then save and move the status forward when ready.');
  }

  return lines.join('\n');
}

function getModuleSuggestions(moduleKey: string): string[] {
  const suggestions: Record<string, string[]> = {
    inventory: [
      'When should I use Adjust QOH vs Receive?',
      'What does QOH mean?',
      'How do I import parts?',
      'What is a cycle count?',
      'How do remnants work?',
    ],
    parts: [
      'What UOM should I choose?',
      'How is sheet SQFT calculated?',
      "What's the difference between cost and price?",
      'How do I create a remnant?',
      'What is a core charge?',
    ],
    sales_orders: [
      'When should I use a quote vs an order?',
      'How do I change UOM correctly?',
      "Why doesn't my total match my line items?",
      'What happens when I invoice?',
      'How do partial payments work?',
    ],
    purchase_orders: [
      'How do I receive a partial shipment?',
      'Why is Remaining not zero?',
      'Should I change unit cost when the invoice differs?',
      'When should I close a PO?',
      'How does PO receiving affect QOH?',
      'How do I link a PO to a WO or SO?',
    ],
    receiving: [
      'When should I receive vs Adjust QOH?',
      'How do partial receives work?',
      'Should I update unit cost if the invoice differs?',
      'Why is my QOH not what I expected?',
      'How do I receive sheet metal correctly?',
      'Where do I record freight/fees?',
    ],
    work_orders: [
      "What's the best way to write concern/notes?",
      'How do labor hours affect totals?',
      'Why did adding parts change QOH?',
      'When should I invoice a WO?',
      'How do I correct a parts quantity mistake?',
      'What does negative QOH mean for the shop?',
    ],
    invoices: [
      'When should I create an invoice from a WO or SO?',
      'What does balance due mean?',
      'How do partial payments work?',
      'What should I do if an invoice is wrong?',
      'Why is an invoice marked overdue?',
      'How do I find unpaid invoices quickly?',
    ],
    payments: [
      'How do I apply a payment to the right invoice?',
      'What happens when I record a partial payment?',
      'How do I void a payment and re-enter it?',
      'Why does the balance due look wrong?',
      'How do I see unpaid balances by customer?',
      'What should I put in payment notes?',
    ],
    scheduling: [
      'How do I avoid overbooking?',
      'What should I put in scheduling notes?',
      'How do I handle waiting parts?',
      'How do I reschedule without losing track?',
      'Why should I link schedule to the WO?',
      "What's the best daily scheduling routine?",
    ],
    warranty_returns: [
      'When should I restock a return?',
      'How do I tie a return to the original invoice?',
      'What should I put in return notes?',
      'How do vendor RMAs work?',
      'How do I track warranty claim status?',
      'Does a return affect QOH automatically?',
    ],
    units: [
      'How do I add a new truck for an existing fleet customer?',
      "What should I fill out on a unit if I'm in a hurry?",
      'How do I quickly see all work we have done on this unit?',
    ],
    technicians: [
      'How should I set up tech names for a large shop?',
      "What's the best way to handle inactive or seasonal techs?",
      'How do techs connect to the schedule and work orders?',
    ],
    plasma_projects: [
      'How do I organize multiple cut jobs for the same customer?',
      "What's the difference between a plasma project and a template?",
      'How should I name plasma projects so they are easy to find later?',
    ],
    plasma_templates: [
      'When should I use a plasma template vs a one-off project?',
      'How do I update a template without losing history?',
      'What info should I always fill out on a template?',
    ],
    receiving_history: [
      'How do I see all receipts for a specific part?',
      'How can I check what was received on a particular PO?',
      'How do I use receiving history to audit inventory issues?',
    ],
    vendors: [
      'What vendor info is most important to set up first?',
      'How do vendors tie into purchase orders and receiving?',
      'How should I handle duplicate vendors?',
    ],
    part_categories: [
      'How should I structure part categories for reporting?',
      'How many categories is too many?',
      "What's the impact of changing a part's category?",
    ],
    cycle_counts: [
      'Which parts should I count first?',
      'How often should I run cycle counts?',
      'How do cycle counts affect on-hand quantity?',
    ],
    returns_warranty_report: [
      'How do I see all warranty jobs for the last 30 days?',
      'How can I spot repeat issues with the same part or component?',
      "What's the best way to use this report in a weekly meeting?",
    ],
    settings: [
      'Which settings should I change first when I set up a new shop?',
      'Who should be allowed to edit settings?',
      'How do settings affect inventory and finance behavior?',
    ],
  };
  return suggestions[moduleKey] || [
    'How do I get started?',
    'What are the key features?',
    'Where can I find more help?',
  ];
}

function getContextSuggestions(moduleKey: string, context?: HelpContext): string[] | null {
  if (context?.status === 'INVOICED') {
    return [
      'How do I create a return for an invoiced order?',
      'Can I print an invoice after it\'s been created?',
      'How do I add notes to an invoiced record?',
      'What happens when I create a credit memo?',
    ];
  }

  if (context?.isEmpty === true && context?.hasCustomer === false) {
    return [
      'How do I search for an existing customer?',
      'How do I create a new customer?',
      'What information do I need to add a customer?',
      'How do I add parts after selecting a customer?',
    ];
  }

  if (context?.hasCustomer === true && context?.hasLines === false) {
    const isWorkOrder = moduleKey === 'work_orders' || context.recordType === 'work_order';
    return [
      'How do I add parts to an order?',
      'What unit of measure should I use?',
      'How do I set the price for a part?',
      isWorkOrder ? 'How do I add labor hours to a work order?' : 'What happens if I enter the wrong quantity?',
    ];
  }

  return null;
}

export function respond(
  moduleKey: string,
  content: ModuleHelpContent,
  userText: string,
  context?: HelpContext
): Response {
  const helpRole = resolveHelpRole(context);
  const normalized = normalizeText(userText);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  const logAndReturn = (answer: string, suggestions: string[]): Response => {
    logHelpInteraction({
      moduleKey,
      playbookTitle: content.title,
      userRole: helpRole,
      renderingMode: renderingModeForRole(helpRole),
      question: userText,
    });
    return { answer, suggestions };
  };

  if (moduleKey === 'customers') {
    const fieldMatch = findCustomerFieldGuideEntry(userText);
    if (fieldMatch) {
      return logAndReturn(buildCustomerFieldAnswer(fieldMatch), [fieldMatch.field, 'Field Guide']);
    }
    const crossModule = detectCustomerCrossModule(userText);
    if (crossModule && !isCustomerFieldQuestion(userText)) {
      return logAndReturn(
        `Customers-only on this screen. Open ${crossModule.label} Help for that topic.`,
        [`Open ${crossModule.label} Help`]
      );
    }
  }

  if (moduleKey === 'sales_orders') {
    const fieldMatch = findSalesOrdersFieldGuideEntry(userText);
    if (fieldMatch) {
      return logAndReturn(buildSalesOrdersFieldAnswer(fieldMatch), [fieldMatch.field, 'Field Guide']);
    }
    const crossModule = detectSalesOrdersCrossModule(userText);
    if (crossModule && !isSalesOrdersFieldQuestion(userText)) {
      return logAndReturn(
        `Sales Orders-only on this screen. Open ${crossModule.label} Help for that topic.`,
        [`Open ${crossModule.label} Help`]
      );
    }
  }

  if (moduleKey === 'work_orders') {
    const fieldMatch = findWorkOrdersFieldGuideEntry(userText);
    if (fieldMatch) {
      return logAndReturn(buildWorkOrdersFieldAnswer(fieldMatch), [fieldMatch.field, 'Field Guide']);
    }
    const crossModule = detectWorkOrdersCrossModule(userText);
    if (crossModule && !isWorkOrdersFieldQuestion(userText)) {
      return logAndReturn(
        `Work Orders-only on this screen. Open ${crossModule.label} Help for that topic.`,
        [`Open ${crossModule.label} Help`]
      );
    }
  }

  if (moduleKey === 'purchase_orders') {
    const fieldMatch = findPurchaseOrdersFieldGuideEntry(userText);
    if (fieldMatch) {
      return logAndReturn(buildPurchaseOrdersFieldAnswer(fieldMatch), [fieldMatch.field, 'Field Guide']);
    }
    const crossModule = detectPurchaseOrdersCrossModule(userText);
    if (crossModule && !isPurchaseOrdersFieldQuestion(userText)) {
      return logAndReturn(
        `Purchase Orders-only on this screen. Open ${crossModule.label} Help for that topic.`,
        [`Open ${crossModule.label} Help`]
      );
    }
  }

  if (moduleKey === 'inventory') {
    const fieldMatch = findInventoryFieldGuideEntry(userText);
    if (fieldMatch) {
      return logAndReturn(buildInventoryFieldAnswer(fieldMatch), [fieldMatch.field, 'Field Guide']);
    }
    const crossModule = detectInventoryCrossModule(userText);
    if (crossModule && !isInventoryFieldQuestion(userText)) {
      return logAndReturn(
        `Inventory-only on this screen. Open ${crossModule.label} Help for that topic.`,
        [`Open ${crossModule.label} Help`]
      );
    }
  }

  if (moduleKey === 'scheduling') {
    const fieldMatch = findSchedulingFieldGuideEntry(userText);
    if (fieldMatch) {
      return logAndReturn(buildSchedulingFieldAnswer(fieldMatch), [fieldMatch.field, 'Field Guide']);
    }
    const crossModule = detectSchedulingCrossModule(userText);
    if (crossModule && !isSchedulingFieldQuestion(userText)) {
      return logAndReturn(
        `Scheduling-only on this screen. Open ${crossModule.label} Help for that topic.`,
        [`Open ${crossModule.label} Help`]
      );
    }
  }

  // Hard safety guard for invoiced records
  if (context?.status === 'INVOICED') {
    const lockedAnswer =
      helpRole === 'Manager/Admin'
        ? 'Record is invoiced and financially locked. Review via print/view, add notes for audit, and use returns/credits instead of editing. Unlocking is not allowed once invoiced.'
        : 'Record is invoiced and locked. View/print details or add notes only; corrections must use a return or credit instead of editing.';
    return logAndReturn(lockedAnswer, ['Invoice print', 'Create return', 'Add note']);
  }

  // Score sections
  const definitionScores: Array<{ def: { term: string; meaning: string }; score: number }> = [];
  const workflowScores: Array<{ workflow: { title: string; steps: string[] }; score: number }> = [];
  const tipScores: Array<{ tip: string; score: number }> = [];

  content.definitions.forEach((def) => {
    const termScore = countMatches(def.term, words);
    const meaningScore = countMatches(def.meaning, words);
    const score = termScore * 2 + meaningScore;
    definitionScores.push({ def, score });
  });

  content.workflows.forEach((workflow) => {
    const titleScore = countMatches(workflow.title, words);
    const stepsScore = workflow.steps.reduce((sum, step) => sum + countMatches(step, words), 0);
    const score = titleScore * 3 + stepsScore;
    workflowScores.push({ workflow, score });
  });

  content.tips.forEach((tipGroup) => {
    tipGroup.items.forEach((tip) => {
      const score = countMatches(tip, words);
      tipScores.push({ tip, score });
    });
  });

  workflowScores.sort((a, b) => b.score - a.score);
  definitionScores.sort((a, b) => b.score - a.score);
  tipScores.sort((a, b) => b.score - a.score);

  const sortedWorkflows =
    workflowScores.length > 0 ? workflowScores : content.workflows.map((workflow) => ({ workflow, score: 0 }));
  const sortedDefs =
    definitionScores.length > 0 ? definitionScores : content.definitions.map((def) => ({ def, score: 0 }));
  const sortedTips =
    tipScores.length > 0
      ? tipScores
      : content.tips.flatMap((group) => group.items.map((tip) => ({ tip, score: 0 })));

  const answerParts: string[] = [];
  const suggestions: string[] = [];

  const addWorkflowBlock = (workflowTitle: string, steps: string[]) => {
    answerParts.push(`**${workflowTitle}**`);
    steps.slice(0, 4).forEach((step, idx) => {
      answerParts.push(`${idx + 1}. ${step}`);
    });
  };

  if (helpRole === 'Technician') {
    answerParts.push('Role: Technician — procedural steps only');
    const topWorkflows = sortedWorkflows.slice(0, 2);
    topWorkflows.forEach(({ workflow }) => addWorkflowBlock(workflow.title, workflow.steps));
    suggestions.push(...topWorkflows.map(({ workflow }) => workflow.title).slice(0, 3));
  } else if (helpRole === 'Service Writer') {
    answerParts.push('Role: Service Writer — workflow + billing impact');
    const topWorkflows = sortedWorkflows.slice(0, 2);
    topWorkflows.forEach(({ workflow }) => addWorkflowBlock(workflow.title, workflow.steps));

    const billingDefs = sortedDefs
      .map(({ def }) => def)
      .filter((def) => hasKeyword(def.term + ' ' + def.meaning, billingKeywords))
      .slice(0, 2);
    if (billingDefs.length > 0) {
      answerParts.push('**Billing / impact terms**');
      billingDefs.forEach((def) => {
        answerParts.push(`• **${def.term}**: ${def.meaning}`);
      });
    }

    const billingTips = sortedTips
      .map(({ tip }) => tip)
      .filter((tip) => hasKeyword(tip, billingKeywords))
      .slice(0, 3);
    if (billingTips.length > 0) {
      answerParts.push('**Billing tips**');
      billingTips.forEach((tip) => answerParts.push(`• ${tip}`));
    }

    suggestions.push(...topWorkflows.map(({ workflow }) => workflow.title).slice(0, 3));
  } else {
    answerParts.push('Role: Manager/Admin — financial, inventory, and audit impact');
    const topWorkflows = sortedWorkflows.slice(0, 2);
    topWorkflows.forEach(({ workflow }) => addWorkflowBlock(workflow.title, workflow.steps));

    const adminDefs = sortedDefs
      .map(({ def }) => def)
      .filter((def) => hasKeyword(def.term + ' ' + def.meaning, adminKeywords))
      .slice(0, 3);
    if (adminDefs.length > 0) {
      answerParts.push('**Financial / inventory terms**');
      adminDefs.forEach((def) => answerParts.push(`• **${def.term}**: ${def.meaning}`));
    }

    const adminTips = sortedTips
      .map(({ tip }) => tip)
      .filter((tip) => hasKeyword(tip, adminKeywords))
      .slice(0, 4);
    if (adminTips.length > 0) {
      answerParts.push('**Controls / audits**');
      adminTips.forEach((tip) => answerParts.push(`• ${tip}`));
    }

    suggestions.push(...topWorkflows.map(({ workflow }) => workflow.title).slice(0, 3));
    if (adminDefs.length === 0 && adminTips.length === 0) {
      answerParts.push('Review locking/finance rules before changing this record.');
    }
  }

  const answer = answerParts.join('\n');
  const dedupedSuggestions = Array.from(new Set(suggestions)).slice(0, 3);

  return logAndReturn(answer, dedupedSuggestions);
}
