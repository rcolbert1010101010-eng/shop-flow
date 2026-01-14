import type { ModuleHelpContent } from '../helpRegistry';

export const dashboardHelp: ModuleHelpContent = {
  title: 'Dashboard',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Dashboard shows key metrics and recent activity at a glance.',
        'Use alerts to catch low stock, overdue invoices, and urgent work.',
        'Recent activity helps you see what changed recently.',
        'Quick links get you to common tasks faster.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Review daily priorities',
      steps: [
        'Check alerts for urgent items',
        'Review open work orders',
        'Check low stock warnings',
        'Follow up on overdue invoices',
      ],
    },
  ],
  definitions: [
    {
      term: 'Dashboard',
      meaning: 'Overview of shop activity and key metrics.',
    },
    {
      term: 'Alerts',
      meaning: 'Warnings about low stock, overdue items, or urgent work.',
    },
    {
      term: 'Recent Activity',
      meaning: 'Latest changes across orders, inventory, and customers.',
    },
  ],
};
