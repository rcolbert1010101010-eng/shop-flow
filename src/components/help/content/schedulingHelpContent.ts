import type { ModuleHelpContent } from '@/help/helpRegistry';

export type SchedulingFieldGuideEntry = {
  field: string;
  what: string;
  when: string;
  example: string;
  mistakes: string;
  impact: string;
  keywords: string[];
};

export const schedulingHelpIndex = [
  {
    title: 'Quick Start',
    items: [
      'Pick the day and review technician lanes for capacity.',
      'Drag jobs into lanes and set planned time estimates.',
      'Use priority only for true urgencies.',
      'Add short scheduling notes for coordination.',
      'Open the Work Order to update status and details.',
    ],
  },
  {
    title: 'Common Workflows',
    items: [
      'Reschedule a job by dragging it to a new time or lane.',
      'Filter by technician or status, then clear filters when done.',
      'Adjust planned time when scope changes.',
      'Use notes for temporary routing (bay, parts, customer drop-off).',
      'Confirm WO status in the Work Order screen before closing the day.',
    ],
  },
  {
    title: 'FAQs',
    items: [
      'Are technician lanes assignments? No—lanes represent capacity only.',
      'Planned vs actual time? Planned is scheduling; actual comes from time tracking.',
      'Does priority change the work order? No—priority only affects schedule ordering.',
      'What do notes do? They are temporary scheduling context, not job history.',
      'Can scheduling replace WO status? No—Work Order status is the source of truth.',
    ],
  },
];

export const schedulingFieldGuide: SchedulingFieldGuideEntry[] = [
  {
    field: 'Technician Lanes (Capacity)',
    what: 'Lanes represent capacity buckets, not firm assignments.',
    when: 'Use to balance workload across the day.',
    example: 'Two lanes show open capacity for the day.',
    mistakes: 'Treating lanes as payroll assignments or overbooking.',
    impact: 'Drives daily plan visibility without changing WO ownership.',
    keywords: ['lane', 'lanes', 'capacity', 'technician lanes'],
  },
  {
    field: 'Job State',
    what: 'Quick read of scheduling state (scheduled, in progress, waiting parts).',
    when: 'Use to see where a job is in the day.',
    example: 'Waiting Parts',
    mistakes: 'Assuming scheduling state updates the Work Order status.',
    impact: 'Helps dispatch but does not change WO state.',
    keywords: ['job state', 'state', 'scheduled', 'in progress', 'waiting parts'],
  },
  {
    field: 'Planned Time',
    what: 'Estimated time used for scheduling only.',
    when: 'Set based on best estimate during scheduling.',
    example: '2.5 hours planned',
    mistakes: 'Using planned time as payroll or actual time.',
    impact: 'Affects daily capacity but not time tracking.',
    keywords: ['planned time', 'estimate', 'planned'],
  },
  {
    field: 'Priority',
    what: 'A scheduling hint to bubble urgent jobs.',
    when: 'Use for true rush or safety items.',
    example: 'High priority for customer waiting',
    mistakes: 'Marking everything high and losing sequencing signal.',
    impact: 'Affects ordering on the schedule only.',
    keywords: ['priority', 'urgent', 'rush'],
  },
  {
    field: 'Scheduling Notes',
    what: 'Temporary coordination notes for the schedule.',
    when: 'Use for bay assignment, waiting parts, or drop-off info.',
    example: 'Needs bay 2, customer drop-off at 9am',
    mistakes: 'Storing long-term job history here instead of the Work Order.',
    impact: 'Helps the day’s plan but is not historical record.',
    keywords: ['notes', 'scheduling notes', 'schedule notes'],
  },
  {
    field: 'Filters',
    what: 'Controls what is visible on the schedule.',
    when: 'Use to focus on a tech, status, or day.',
    example: 'Filter to one technician for dispatching.',
    mistakes: 'Leaving filters on and missing work.',
    impact: 'Can hide jobs; always clear when done.',
    keywords: ['filters', 'filter', 'visibility'],
  },
  {
    field: 'Drag to Reschedule',
    what: 'Drag-and-drop to change day/time or lane.',
    when: 'Use when plan changes or parts arrive.',
    example: 'Move job to tomorrow morning.',
    mistakes: 'Rescheduling without updating the Work Order status.',
    impact: 'Updates the schedule only; WO state remains separate.',
    keywords: ['drag', 'drag and drop', 'reschedule'],
  },
  {
    field: 'Open Job Actions',
    what: 'Open the job to manage details in the Work Order.',
    when: 'Use to update status, labor, or parts.',
    example: 'Open WO to mark In Progress.',
    mistakes: 'Trying to change core job data from scheduling only.',
    impact: 'Keeps scheduling aligned with the true WO record.',
    keywords: ['open job', 'open work order', 'actions'],
  },
  {
    field: 'Work Orders Relationship',
    what: 'Scheduling does not replace Work Order state.',
    when: 'Always confirm status changes in the Work Order screen.',
    example: 'Mark WO Completed in Work Orders, not Scheduling.',
    mistakes: 'Assuming schedule changes update WO status.',
    impact: 'Prevents status mismatches and billing errors.',
    keywords: ['work order', 'wo status', 'relationship'],
  },
];

export const schedulingHelpContent: ModuleHelpContent = {
  title: 'Scheduling',
  tips: schedulingHelpIndex,
  workflows: [],
  definitions: schedulingFieldGuide.map((entry) => ({
    term: entry.field,
    meaning:
      `What it is: ${entry.what} ` +
      `When to use: ${entry.when} ` +
      `Example: ${entry.example} ` +
      `Common mistakes: ${entry.mistakes} ` +
      `Downstream impact: ${entry.impact}`,
  })),
};
