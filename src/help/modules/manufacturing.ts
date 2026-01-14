import type { ModuleHelpContent } from '../helpRegistry';

export const manufacturingHelp: ModuleHelpContent = {
  title: 'Manufacturing',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Keep every job tied to the order/work order when possible—traceability matters.',
        "Use the traveler/build sheet as the shop's single source of truth.",
        'Record time estimates so scheduling and capacity planning stays realistic.',
        'Clear notes prevent rework: material, thickness, finish, and special instructions.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Create a manufacturing job',
      steps: [
        'Create job',
        'Link to WO/SO (if available)',
        'Choose operation',
        'Add notes/specs',
        'Save',
      ],
    },
    {
      title: 'Run a job through operations',
      steps: [
        'Cut',
        'Form',
        'Weld',
        'Finish',
        'Mark complete (update status as you go)',
      ],
    },
    {
      title: 'Use a traveler/build sheet',
      steps: [
        'Review specs',
        'Follow steps',
        'Check off QC points',
        'Add completion notes',
      ],
    },
    {
      title: 'Plan capacity',
      steps: [
        'Review queued work',
        'Check estimated minutes',
        'Assign resources',
        'Adjust priorities',
      ],
    },
  ],
  definitions: [
    {
      term: 'Operation / Work center',
      meaning: 'Where the work happens (plasma, brake, weld, assembly).',
    },
    {
      term: 'Traveler / Build sheet',
      meaning: 'Printed or digital instructions for the shop.',
    },
    {
      term: 'Estimated minutes',
      meaning: 'Planned time for scheduling and quoting.',
    },
    {
      term: 'Actual minutes',
      meaning: 'Real time used (helps profitability and future estimates).',
    },
    {
      term: 'QC / Checkoff',
      meaning: 'Quality checkpoints to prevent rework.',
    },
  ],
};
