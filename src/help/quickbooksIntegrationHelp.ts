export const quickbooksIntegrationHelp = {
  title: 'QuickBooks Integration',
  sections: [
    {
      heading: 'What this does',
      bullets: [
        'Connects ShopFlow to QuickBooks Online so invoices are recorded automatically.',
        'Supports Live Transfer (automatic) and Manual Export (download and review before sending).',
      ],
    },
    {
      heading: 'Setup overview',
      bullets: [
        'Step 1: Click Connect to QuickBooks and authorize via your QuickBooks Online account.',
        'Step 2: Enter your QuickBooks item IDs for Labor, Parts, and Fees/Sublet.',
        'Step 3: Choose Live Transfer or Manual Export, enable the integration, and save.',
      ],
    },
    {
      heading: 'Live Transfer',
      bullets: [
        'Invoices are automatically sent to QuickBooks within 5 minutes of being finalized.',
        'Failed exports retry automatically at 5, 15, and 60 minute intervals.',
        'Monitor status in the Export History table.',
      ],
    },
    {
      heading: 'Manual Export',
      bullets: [
        'Invoices are queued in ShopFlow but not sent automatically.',
        'Use the Download button in Export History to get the JSON payload.',
        'Send the file to your accountant or use it with QuickBooks import tools.',
      ],
    },
    {
      heading: 'Common issues',
      bullets: [
        'Export failed: Check the Error column. Usually an expired token or invalid item ID.',
        'No exports appearing: Make sure Enable Integration is on and saved.',
        'Invoice not exporting: Invoice must be ISSUED status - drafts and voided invoices are skipped.',
        'Connection expired: Tokens expire after 100 days of inactivity. Click Reconnect.',
      ],
    },
  ],
};
