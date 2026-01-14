import type { ModuleHelpContent } from '../helpRegistry';

export const schedulingHelp: ModuleHelpContent = {
  title: 'Scheduling',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Schedule is the plan—keep it real so the shop stays predictable.',
        "Don't overbook a tech. Leave room for surprises.",
        "Use status and notes so everyone understands what's blocked.",
        'Tie scheduled blocks to the Work Order for clean history.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Schedule a job',
      steps: [
        'Find the WO',
        'Assign tech',
        'Set date/time',
        'Add short notes',
        'Save',
      ],
    },
    {
      title: 'Reschedule',
      steps: [
        'Drag/move the block (or edit)',
        'Update notes',
        'Notify customer if needed',
      ],
    },
    {
      title: 'Handle waiting parts',
      steps: [
        "Mark status 'Waiting Parts'",
        'Push date out',
        'Add note for follow-up',
      ],
    },
    {
      title: 'Daily plan',
      steps: [
        'Review today',
        'Check overdue/priority',
        'Confirm bays/resources',
        'Adjust',
      ],
    },
  ],
  definitions: [
    {
      term: 'Scheduled block',
      meaning: 'Reserved time for a job.',
    },
    {
      term: 'Capacity',
      meaning: 'How much work a tech can realistically take.',
    },
    {
      term: 'Priority',
      meaning: 'Urgent jobs that should surface.',
    },
    {
      term: 'WO link',
      meaning: 'Keeps schedule tied to the repair job.',
    },
  ],
};
