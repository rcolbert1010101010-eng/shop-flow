import type { ModuleHelpContent } from '../helpRegistry';

export const plasmaTemplatesHelp: ModuleHelpContent = {
  title: 'Plasma Templates',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Use templates for common parts and repeatable patterns to save setup time.',
        'Name templates clearly with material and thickness so they’re easy to pick later.',
        'Keep revisions tidy—update the template instead of cloning unless the design truly changes.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a template',
      steps: ['Open Plasma Templates', 'Click New', 'Enter name/description', 'Set material/thickness if applicable', 'Save'],
    },
    {
      title: 'Update a template',
      steps: ['Open template', 'Edit dimensions/notes/thickness', 'Save changes'],
    },
    {
      title: 'Use a template in a project',
      steps: ['Open a plasma project', 'Apply or add the template', 'Review cut details', 'Save'],
    },
  ],
  definitions: [
    { term: 'Plasma template', meaning: 'A reusable cut definition for common parts.' },
    { term: 'Revision', meaning: 'An updated version of a template when the design changes.' },
    { term: 'Material thickness', meaning: 'The plate thickness to cut; keep it consistent in the template.' },
  ],
};
