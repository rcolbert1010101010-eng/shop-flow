import type { ModuleHelpContent } from '@/help/helpRegistry';
import { getModuleHelp } from '@/help/helpRegistry';
import type { HelpContext } from '@/help/types';

interface Response {
  answer: string;
  suggestions: string[];
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
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
    lines.push('Next, you'll usually:');
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
    manufacturing: [
      "What's the best way to write a traveler?",
      'How do I link manufacturing work to a WO or SO?',
      'What should I track for time and profitability?',
      'How do I plan capacity for next week?',
      'What statuses should we use for fab work?',
      'How do plasma/brake/weld jobs differ in tracking?',
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
  const normalized = normalizeText(userText);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  
  // Context-aware overrides (highest priority first)
  if (context?.status === 'INVOICED') {
    return {
      answer: 'This record is already invoiced, so most fields are locked to keep the invoice accurate. You can still view and print all details, add notes for your records, create returns or warranty claims, and start a new order or work order if needed. If you need to correct something, create a new transaction like a return or credit memo rather than editing the invoiced record.',
      suggestions: [
        'How do I create a return for an invoiced order?',
        'Can I print an invoice after it\'s been created?',
        'How do I add notes to an invoiced record?',
        'What happens when I create a credit memo?',
      ],
    };
  }

  if (context?.isEmpty === true && context?.hasCustomer === false) {
    const recordTypeLabel = context.recordType ? context.recordType.replace(/_/g, ' ') : 'order';
    return {
      answer: `Start by selecting or adding a customer first. Use the customer search to find an existing customer, or create a new one if needed. Once you have a customer selected, you can add parts and labor to build the ${recordTypeLabel}, set pricing, and track all work for them.`,
      suggestions: [
        'How do I search for an existing customer?',
        'How do I create a new customer?',
        'What information do I need to add a customer?',
        'How do I add parts after selecting a customer?',
      ],
    };
  }

  if (context?.hasCustomer === true && context?.hasLines === false) {
    const recordTypeLabel = context.recordType ? context.recordType.replace(/_/g, ' ') : 'order';
    const isWorkOrder = moduleKey === 'work_orders' || context.recordType === 'work_order';
    const lineType = isWorkOrder ? 'parts or labor' : 'parts';
    const addAction = isWorkOrder ? '"Add Part" or "Add Labor"' : '"Add Part"';
    return {
      answer: `You have a customer selected. Now add your first line item using ${addAction} for ${lineType}. Common mistakes to avoid: entering the wrong quantity, using the wrong unit of measure, or forgetting to set the price before saving. Double-check these before you save the line.`,
      suggestions: [
        'How do I add parts to an order?',
        'What unit of measure should I use?',
        'How do I set the price for a part?',
        isWorkOrder ? 'How do I add labor hours to a work order?' : 'What happens if I enter the wrong quantity?',
      ],
    };
  }

  if (isExplainQuestion(userText)) {
    return {
      answer: buildExplainAnswer(moduleKey, content, context),
      suggestions: getContextSuggestions(moduleKey, context) ?? getModuleSuggestions(moduleKey),
    };
  }

  if (words.length === 0) {
    return {
      answer: `Here's an overview of ${content.title}:\n\n${content.workflows[0]?.title || 'Get started'} workflow:\n${content.workflows[0]?.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n') || 'No workflows available'}`,
      suggestions: getContextSuggestions(moduleKey, context) ?? getModuleSuggestions(moduleKey),
    };
  }

  // Score sections
  const definitionScores: Array<{ def: { term: string; meaning: string }; score: number }> = [];
  const workflowScores: Array<{ workflow: { title: string; steps: string[] }; score: number }> = [];
  const tipScores: Array<{ tip: string; score: number }> = [];

  // Score definitions
  content.definitions.forEach((def) => {
    const termScore = countMatches(def.term, words);
    const meaningScore = countMatches(def.meaning, words);
    const score = termScore * 2 + meaningScore; // Terms weighted higher
    if (score > 0) {
      definitionScores.push({ def, score });
    }
  });

  // Score workflows
  content.workflows.forEach((workflow) => {
    const titleScore = countMatches(workflow.title, words);
    const stepsScore = workflow.steps.reduce((sum, step) => sum + countMatches(step, words), 0);
    const score = titleScore * 3 + stepsScore; // Title weighted higher
    if (score > 0) {
      workflowScores.push({ workflow, score });
    }
  });

  // Score tips
  content.tips.forEach((tipGroup) => {
    tipGroup.items.forEach((tip) => {
      const score = countMatches(tip, words);
      if (score > 0) {
        tipScores.push({ tip, score });
      }
    });
  });

  // Sort by score
  definitionScores.sort((a, b) => b.score - a.score);
  workflowScores.sort((a, b) => b.score - a.score);
  tipScores.sort((a, b) => b.score - a.score);

  const parts: string[] = [];

  // Add definitions (up to 3)
  if (definitionScores.length > 0) {
    const topDefs = definitionScores.slice(0, 3);
    parts.push('**Definitions:**');
    topDefs.forEach(({ def }) => {
      parts.push(`• **${def.term}**: ${def.meaning}`);
    });
  }

  // Add workflows (1-2, max 4 steps each)
  if (workflowScores.length > 0) {
    const topWorkflows = workflowScores.slice(0, 2);
    topWorkflows.forEach(({ workflow }) => {
      parts.push(`\n**${workflow.title}:**`);
      const stepsToShow = workflow.steps.slice(0, 4);
      stepsToShow.forEach((step, idx) => {
        parts.push(`${idx + 1}. ${step}`);
      });
      if (workflow.steps.length > 4) {
        parts.push(`... and ${workflow.steps.length - 4} more step${workflow.steps.length - 4 > 1 ? 's' : ''}`);
      }
    });
  }

  // Add tips (up to 5)
  if (tipScores.length > 0) {
    const topTips = tipScores.slice(0, 5);
    if (topTips.length > 0) {
      parts.push('\n**Tips:**');
      topTips.forEach(({ tip }) => {
        parts.push(`• ${tip}`);
      });
    }
  }

  // If no strong matches, show default workflows
  if (parts.length === 0) {
    if (content.workflows.length > 0) {
      parts.push(`Here are the main workflows for ${content.title}:`);
      content.workflows.slice(0, 2).forEach((workflow) => {
        parts.push(`\n**${workflow.title}:**`);
        workflow.steps.slice(0, 3).forEach((step, idx) => {
          parts.push(`${idx + 1}. ${step}`);
        });
      });
      parts.push('\nTry asking about specific terms or steps for more details.');
    } else {
      parts.push(`I can help you with ${content.title}. Try asking about specific features or terms.`);
    }
  }

  const answer = parts.join('\n');

  // Generate suggestions based on what wasn't covered
  const suggestions: string[] = [];
  if (definitionScores.length === 0 && content.definitions.length > 0) {
    suggestions.push(`What does ${content.definitions[0]?.term} mean?`);
  }
  if (workflowScores.length === 0 && content.workflows.length > 0) {
    suggestions.push(`How do I ${content.workflows[0]?.title.toLowerCase()}?`);
  }
  if (suggestions.length < 3) {
    const contextSuggestions = getContextSuggestions(moduleKey, context);
    const fallbackSuggestions = contextSuggestions ?? getModuleSuggestions(moduleKey);
    suggestions.push(...fallbackSuggestions.slice(0, 3 - suggestions.length));
  }

  return {
    answer,
    suggestions: suggestions.slice(0, 3),
  };
}
