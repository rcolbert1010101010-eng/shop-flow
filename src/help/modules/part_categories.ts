import type { ModuleHelpContent } from '../helpRegistry';

export const partCategoriesHelp: ModuleHelpContent = {
  title: 'Part Categories',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Use categories for reporting and pricing—avoid lumping everything into “misc.”',
        'Keep the list simple but meaningful so filters and profitability reports stay useful.',
        'Name categories in shop language (brakes, electrical, hydraulics, fabrication).',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a category',
      steps: ['Open Categories', 'Click Add', 'Enter name/description', 'Save'],
    },
    {
      title: 'Reassign a part’s category',
      steps: ['Open the part', 'Change its category (if allowed)', 'Save and confirm pricing/reporting impact'],
    },
  ],
  definitions: [
    { term: 'Part category', meaning: 'A grouping used for browsing, pricing, and reporting.' },
    { term: 'Category hierarchy', meaning: 'If used, parent/child categories to organize parts; keep it shallow and clear.' },
  ],
};
