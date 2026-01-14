import type { ModuleHelpContent } from '../helpRegistry';

export const cycleCountsHelp: ModuleHelpContent = {
  title: 'Cycle Counts',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Do small, frequent counts—start with high-movement or high-value items.',
        'Use clear bins/locations so counting is fast and repeatable.',
        'Post adjustments carefully; respect any rules about negative QOH.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Start a cycle count',
      steps: ['Open Cycle Counts', 'Click New', 'Pick items or area to count', 'Save session'],
    },
    {
      title: 'Enter counted quantities',
      steps: ['Open the session', 'Record counted qty per item', 'Review variances', 'Save'],
    },
    {
      title: 'Post adjustments',
      steps: ['Review variances', 'Confirm reasons/notes', 'Post to update QOH (respect shop policy)'],
    },
  ],
  definitions: [
    { term: 'Cycle count', meaning: 'A small, frequent inventory check instead of a full physical.' },
    { term: 'Count variance', meaning: 'Difference between counted quantity and system quantity.' },
    { term: 'Adjustment', meaning: 'The posted change to on-hand to match the count.' },
  ],
};
