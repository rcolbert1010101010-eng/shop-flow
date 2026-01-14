import type { ModuleHelpContent } from '../helpRegistry';

export const unitsHelp: ModuleHelpContent = {
  title: 'Units / Equipment',
  tips: [
    {
      title: 'Quick Tips',
      items: [
        'Search by customer, VIN, unit number, plate, or description to find the right asset fast.',
        'Keep core data clean: VIN, year/make/model, meter readings, and any fleet/unit IDs.',
        'Always link units to the correct customer so work orders and history stay accurate.',
      ],
    },
  ],
  workflows: [
    {
      title: 'Add a new unit',
      steps: ['Open Units', 'Choose customer', 'Enter VIN/year/make/model', 'Save'],
    },
    {
      title: 'Use a unit on a new work order',
      steps: ['Start WO', 'Select customer', 'Pick unit from their list', 'Confirm VIN/meter if needed'],
    },
    {
      title: 'Review service history',
      steps: ['Open unit record', 'Review past WOs', 'Check notes and meter trends', 'Write the new ticket'],
    },
  ],
  definitions: [
    { term: 'Unit / Asset', meaning: 'A customer’s vehicle or equipment you service.' },
    { term: 'VIN', meaning: 'Vehicle identification number—unique ID for the unit.' },
    { term: 'Meter reading', meaning: 'Odometer or hours reading used for maintenance intervals.' },
    { term: 'Primary unit', meaning: 'The main asset for that customer, often shown first in lists.' },
  ],
};
