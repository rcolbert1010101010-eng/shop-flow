import type { ModuleHelpContent } from '../helpRegistry';

export const returnsWarrantyReportHelp: ModuleHelpContent = {
  title: 'Returns & Warranty Report',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Use this report to spot comebacks, warranty claims, and return trends.',
        'Watch patterns by technician, part, vendor, or job type.',
        'Review regularly with the team to reduce repeat issues.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Review recent returns/warranty',
      steps: ['Open the report', 'Filter by date range', 'Sort by severity or cost', 'Open items that need action'],
    },
    {
      title: 'Drill into a specific job',
      steps: ['Select the return/warranty row', 'Review notes and parts involved', 'Capture info needed for vendor/OEM claim'],
    },
    {
      title: 'Share data for claims',
      steps: ['Filter and gather the relevant rows', 'Export or summarize key details', 'Send to vendor/OEM as needed'],
    },
  ],
  definitions: [
    { term: 'Comeback', meaning: 'A job that returns for the same issue after delivery.' },
    { term: 'Warranty claim', meaning: 'A request to vendor/OEM to cover failed parts or workmanship under warranty.' },
    { term: 'Core', meaning: 'Returnable part used to obtain a core credit from the vendor/OEM.' },
    { term: 'RMA', meaning: 'Return merchandise authorization number used to track a vendor/OEM return.' },
  ],
};
