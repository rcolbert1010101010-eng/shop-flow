import type { ModuleHelpContent } from '../helpRegistry';

export const receivingHistoryHelp: ModuleHelpContent = {
  title: 'Receiving History',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Use receiving history as your audit trail—what was received, when, and from which PO.',
        'Filter by date, vendor, part, or PO to answer “what happened?” quickly.',
        'Cross-check quantities against the original PO when investigating QOH issues.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Find receipts for a part',
      steps: ['Open Receiving History', 'Filter/search by part or vendor', 'Review dated receipts', 'Drill into the one you need'],
    },
    {
      title: 'Confirm what was received on a PO',
      steps: ['Search by PO reference', 'Open the receipt', 'Compare received qty vs ordered', 'Note any over/under receive'],
    },
    {
      title: 'Audit a discrepancy',
      steps: ['Filter by part/vendor/date range', 'Open recent receipts', 'Check who received and the quantities', 'Match against current QOH'],
    },
  ],
  definitions: [
    { term: 'Receiving event', meaning: 'A recorded receipt of parts into inventory.' },
    { term: 'PO receipt', meaning: 'Receiving tied to a purchase order.' },
    { term: 'Over-receive/Under-receive', meaning: 'Received more/less than ordered (if the workflow allows it).' },
  ],
};
