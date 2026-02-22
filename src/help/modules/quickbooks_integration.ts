import type { ModuleHelpContent } from '../helpRegistry';

export const quickbooksIntegrationHelp: ModuleHelpContent = {
  title: 'QuickBooks Integration',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Connect QuickBooks first before configuring item mappings.',
        'You need three QuickBooks service items: Labor, Parts, and Fees/Sublet.',
        'Use Live Transfer for automatic sync. Use Manual Export for full control.',
        'Invoices must be ISSUED status to trigger an export.',
        'Toggle Enable Integration off to pause exports without losing your settings.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Initial setup',
      steps: [
        'Go to Settings then Integrations then QuickBooks',
        'Click Connect to QuickBooks and authorize with your QB Online account',
        'Enter item IDs for Labor, Parts, and Fees/Sublet',
        'Choose Live Transfer or Manual Export',
        'Toggle Enable Integration on and click Save Settings',
      ],
    },
    {
      title: 'Manual export workflow',
      steps: [
        'Finalize an invoice in ShopFlow',
        'Go to QuickBooks Integration page',
        'Find the export in Export History with Pending status',
        'Click Download to get the JSON payload',
        'Send the file to your accountant or import into QuickBooks',
      ],
    },
    {
      title: 'Fix a failed export',
      steps: [
        'Go to QuickBooks Integration page',
        'Find the export with Failed status',
        'Check the Error column for the cause',
        'Fix the issue (reconnect QB or update item IDs)',
        'Click Retry to reset the export to Pending',
      ],
    },
    {
      title: 'Reconnect QuickBooks',
      steps: [
        'Go to QuickBooks Integration page',
        'Click Reconnect',
        'Authorize with your QuickBooks Online credentials',
        'Connection is restored - pending exports will resume',
      ],
    },
  ],
  definitions: [
    {
      term: 'Live Transfer',
      meaning: 'Invoices are automatically sent to QuickBooks within 5 minutes of being finalized.',
    },
    {
      term: 'Manual Export',
      meaning: 'Invoices are queued in ShopFlow. You download and send them to QuickBooks manually.',
    },
    {
      term: 'Item ID',
      meaning: 'The QuickBooks Products and Services item number used to categorize charges on an invoice.',
    },
    {
      term: 'Export History',
      meaning: 'Table showing all invoices queued for QuickBooks with their current status.',
    },
    {
      term: 'Pending',
      meaning: 'Export is queued and waiting to be sent to QuickBooks.',
    },
    {
      term: 'Sent',
      meaning: 'Export was successfully posted to QuickBooks.',
    },
    {
      term: 'Failed',
      meaning: 'An error occurred while sending to QuickBooks. Check the Error column and retry.',
    },
  ],
};
