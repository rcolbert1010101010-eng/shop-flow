import { inventoryHelp } from './modules/inventory';
import { partsHelp } from './modules/parts';

export interface ModuleHelpContent {
  title: string;
  tips: { title?: string; items: string[] }[];
  workflows: { title: string; steps: string[] }[];
  definitions: { term: string; meaning: string }[];
}

export const helpByModule: Record<string, ModuleHelpContent> = {
  inventory: inventoryHelp,
  parts: partsHelp,
};

export function getModuleHelp(moduleKey: string): ModuleHelpContent | null {
  return helpByModule[moduleKey] || null;
}
