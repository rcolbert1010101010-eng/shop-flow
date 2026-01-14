import type { ModuleHelpContent } from '../helpRegistry';

export const settingsHelp: ModuleHelpContent = {
  title: 'Settings',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Only trusted users should change system-wide settings.',
        'Make one change at a time and test in a safe workflow.',
        'Document major changes so the team knows what shifted.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Update basic shop info',
      steps: ['Open Settings', 'Edit shop name/logo/contact info', 'Save', 'Verify on prints/emails if applicable'],
    },
    {
      title: 'Adjust a policy or toggle',
      steps: ['Open Settings', 'Find the policy/feature toggle', 'Change value', 'Save and verify behavior in a test flow'],
    },
  ],
  definitions: [
    { term: 'System settings', meaning: 'Global configuration that affects the whole shop.' },
    { term: 'Feature flag / toggle', meaning: 'A switch to enable/disable a feature or policy.' },
    { term: 'Policy', meaning: 'A rule that affects behavior (e.g., negative QOH allowed).' },
  ],
};
