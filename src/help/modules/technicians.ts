import type { ModuleHelpContent } from '../helpRegistry';

export const techniciansHelp: ModuleHelpContent = {
  title: 'Technicians',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Keep the tech list current—use inactive instead of delete.',
        'Record skill tags or specialties to route jobs correctly.',
        'Tech setup affects scheduling, time tracking, and profitability views.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Add a technician',
      steps: ['Open Technicians', 'Click Add', 'Enter name/contact', 'Set default rate/skills (if available)', 'Save'],
    },
    {
      title: 'Update skills or rate',
      steps: ['Open tech record', 'Edit skills/tags and default rate', 'Save changes'],
    },
    {
      title: 'Make a tech inactive',
      steps: ['Open tech record', 'Toggle inactive', 'Save (keeps history, hides from scheduling)'],
    },
  ],
  definitions: [
    { term: 'Technician', meaning: 'A person doing labor on work orders or projects.' },
    { term: 'Skill tags', meaning: 'Notes or labels for specialties (diesel, electrical, hydraulics, fabrication).' },
    { term: 'Active/Inactive', meaning: 'Active shows in scheduling and assignments; inactive hides but keeps history.' },
  ],
};
