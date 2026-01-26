import type { ModuleHelpContent } from '@/help/helpRegistry';

export type CustomerFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const customersHelpIndex = [
    {
      title: 'Quick Start',
      items: [
        'Add the Company Name and primary contact info.',
        'Set Address and communication details.',
        'Choose Price Level and tax settings. Set Payment Terms in the Account section if needed.',
        'Save, then add contacts or locations as needed.',
      ],
    },
  {
    title: 'Common Tasks',
    items: [
      'Set up a fleet account and default price level',
      'Set or change Price Level (Retail, Fleet, Wholesale)',
      'Mark Tax Exempt or set a Tax Rate Override',
      'Add or update a Contact',
      'Add or update Address details',
      'Use Notes for internal handling instructions',
      'Create a work order or sales order from the customer',
      'View customer history from the detail page',
    ],
  },
    {
      title: 'FAQs',
      items: [
        'Name vs legal name: Only Company Name is visible here, so use the legal billing name.',
        'Why do prices differ? Price Level sets the default pricing tier for this customer.',
        'Tax exempt vs tax override: Use one or the other, never both at the same time.',
        'Where do I set Payment Terms? Use the Account section on the customer detail page.',
        'What should Notes contain? Internal-only handling, access, approvals, or preferences.',
        'When should I use Fleet? Use Fleet when the customer has contracted pricing.',
      ],
    },
];

export const customersFieldGuide: CustomerFieldGuideEntry[] = [
  {
    field: 'Company Name *',
    what: 'The official customer name used in billing and search.',
    when: 'Always use the legal billing name for accurate documents.',
    example: 'Northstar Logistics, Inc.',
    mistakes: 'Using nicknames, abbreviations, or inconsistent casing that creates duplicates.',
    impact: 'Shows on work orders, sales orders, invoices, statements, reports, and exports.',
    keywords: ['company name', 'customer name', 'legal name', 'display name'],
  },
  {
    field: 'Price Level (Retail / Fleet / Wholesale)',
    what: 'The default pricing tier for this customer.',
    when: 'Set to match the customer agreement before quoting or selling.',
    example: 'Fleet',
    mistakes: 'Leaving Retail for fleet accounts or changing after quotes are issued.',
    impact: 'Sets default pricing on work orders and sales orders; affects pricing reports.',
    keywords: ['price level', 'pricing tier', 'price tier', 'retail', 'fleet', 'wholesale'],
  },
  {
    field: 'Tax Exempt',
    what: 'A flag that removes sales tax for this customer.',
    when: 'Enable only with a valid exemption certificate on file.',
    example: 'Enabled with certificate on file',
    mistakes: 'Enabling without documentation or leaving it on after expiration.',
    impact: 'Changes tax on invoices and statements and impacts tax reporting.',
    keywords: ['tax exempt', 'exempt'],
  },
  {
    field: 'Tax Rate Override (%)',
    what: 'A specific tax rate that overrides the default rate.',
    when: 'Use only for special jurisdictions or contracted tax rates.',
    example: '7.25',
    mistakes: 'Using it with Tax Exempt or entering 725 instead of 7.25.',
    impact: 'Overrides tax calculation on invoices and tax reports.',
    keywords: ['tax rate', 'tax override', 'override'],
  },
  {
    field: 'Contact Name',
    what: 'The primary contact name shown on the customer record.',
    when: 'Use for the main person to reach if no full contact list is maintained.',
    example: 'Samantha Lee',
    mistakes: 'Using a department name or leaving stale contact info.',
    impact: 'Appears in customer lists, work orders, sales orders, and exports.',
    keywords: ['contact name', 'primary contact name'],
  },
  {
    field: 'Phone',
    what: 'Primary phone number for the customer or primary contact.',
    when: 'Use a number that reaches the decision maker or dispatcher.',
    example: '406-555-0101',
    mistakes: 'Outdated numbers or switchboards without extensions.',
    impact: 'Shown on customer detail and exports; used for follow-ups.',
    keywords: ['phone', 'telephone'],
  },
  {
    field: 'Email',
    what: 'Primary email for approvals and documents.',
    when: 'Use a monitored inbox for dispatch or billing.',
    example: 'dispatch@northstar.com',
    mistakes: 'Typos or unowned shared inboxes.',
    impact: 'Used for invoice and statement delivery and exports.',
    keywords: ['email', 'e-mail'],
  },
  {
    field: 'Address',
    what: 'The billing address for this customer.',
    when: 'Keep current with the legal billing address.',
    example: '123 Fleet Ave, Billings, MT 59101',
    mistakes: 'Using a ship-to dock or leaving outdated info.',
    impact: 'Prints on invoices and statements and appears in reports/exports.',
    keywords: ['address', 'billing address'],
  },
  {
    field: 'Notes',
    what: 'Internal-only handling instructions and flags.',
    when: 'Use for approvals, access instructions, or preferences.',
    example: 'After-hours drop key in lockbox.',
    mistakes: 'Storing sensitive info or customer-facing text.',
    impact: 'Visible to staff and included in some exports.',
    keywords: ['notes', 'internal notes', 'internal flags'],
  },
];

export const customersHelpContent: ModuleHelpContent = {
  title: 'Customers',
  tips: customersHelpIndex,
  workflows: [],
  definitions: customersFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
