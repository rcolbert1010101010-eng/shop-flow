import type { ModuleHelpContent } from '../helpRegistry';

export const plasmaProjectsHelp: ModuleHelpContent = {
  title: 'Plasma Projects',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Use projects as containers for multiple cut jobs for the same customer.',
        'Keep project names, customer, and linked orders consistent so history stays clear.',
        'Track status (planned, cutting, complete) so the shop knows what’s next.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a plasma project',
      steps: ['Open Plasma Projects', 'Click New', 'Add customer/details', 'Save and start adding cuts/templates'],
    },
    {
      title: 'Attach parts/templates',
      steps: ['Open project', 'Add parts or apply a template', 'Review material/thickness', 'Save'],
    },
    {
      title: 'Track project status',
      steps: ['Open project', 'Update status as work progresses', 'Mark complete when cut jobs finish'],
    },
  ],
  definitions: [
    { term: 'Plasma project', meaning: 'A grouping of related cut jobs for a customer.' },
    { term: 'Nest', meaning: 'A set of parts laid out for a cut run.' },
    { term: 'Cut job', meaning: 'An individual cutting task within the project.' },
  ],
};
