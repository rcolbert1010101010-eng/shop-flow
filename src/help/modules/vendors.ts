import type { ModuleHelpContent } from '../helpRegistry';

export const vendorsHelp: ModuleHelpContent = {
  title: 'Vendors',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Keep vendor contacts, terms, and account numbers up to date.',
        'Link vendors to parts and POs so purchasing and receiving stay accurate.',
        'Avoid duplicates—clean up names and merge where possible.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Add a vendor',
      steps: ['Open Vendors', 'Click Add', 'Enter name/contact/terms', 'Save'],
    },
    {
      title: 'Update vendor details',
      steps: ['Open vendor record', 'Edit contact info or terms', 'Save changes'],
    },
    {
      title: 'Find parts from a vendor',
      steps: ['Use search/filter by vendor (if available)', 'Open part list tied to that vendor', 'Plan purchasing accordingly'],
    },
  ],
  definitions: [
    { term: 'Vendor', meaning: 'Supplier you buy parts or materials from.' },
    { term: 'Primary vendor', meaning: 'Preferred supplier for a part.' },
    { term: 'Terms', meaning: 'Payment terms (e.g., Net 30, Net 15, COD).' },
    { term: 'Account number', meaning: 'Your identifier with the vendor for billing and tracking.' },
  ],
};
