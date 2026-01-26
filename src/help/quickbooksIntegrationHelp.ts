export const quickbooksIntegrationHelp = {
  title: 'QuickBooks Integration (Offline Export Queue)',
  sections: [
    {
      heading: 'What this does',
      bullets: [
        'Queues accounting export payloads inside ShopFlow (no QuickBooks connection or OAuth required).',
        'Exports are stored in accounting_exports for later download/use by your accounting team.',
      ],
    },
    {
      heading: 'Transfer mode',
      bullets: [
        'Live Transfer: exports queue and the sender can post to QuickBooks automatically.',
        'Import: exports are disabled and the sender will not run (use for inbound-only workflows).',
      ],
    },
    {
      heading: 'Setup steps',
      bullets: [
        'Enable the integration.',
        'Choose Mode: INVOICE_ONLY or INVOICE_AND_PAYMENTS (needed to export payments).',
        'Confirm Export Trigger: ON_INVOICE_FINALIZED for invoices; ON_PAYMENT_RECORDED for payments.',
        'Map accounts: labor, parts, fees/sublet, tax liability, clearing/undeposited funds.',
        'Use “Test Export” to confirm a payload is written to accounting_exports.',
      ],
    },
    {
      heading: 'How auto-export works',
      bullets: [
        'When an invoice is ISSUED (not draft/voided) and triggers are on, ShopFlow queues an export automatically.',
        'Payments export only when Mode is INVOICE_AND_PAYMENTS and the payment trigger is on.',
      ],
    },
    {
      heading: 'Where to see exports',
      bullets: [
        'Check the Recent Exports table for status, attempts, and payloads.',
        'Use “View JSON” to inspect payloads; “Retry” sets status back to PENDING.',
      ],
    },
    {
      heading: 'Common issues',
      bullets: [
        '“Skipped (disabled)” means the integration or trigger is off, or mode does not allow that export type.',
        'Only admins can change settings; exports may still queue automatically if enabled.',
      ],
    },
    {
      heading: 'FAQ',
      bullets: [
        'Does this connect to QuickBooks? No. It only stages payloads inside ShopFlow.',
        'Does it send anything to QuickBooks? No. You can download/use payloads later.',
        'Can I download/export later? Yes—use the payloads in accounting_exports or the View JSON action.',
      ],
    },
  ],
};
