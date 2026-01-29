import { plasmaPricingDefaults } from '@/services/plasmaPricingService';

export type SystemSettingValueType = 'number' | 'boolean' | 'string' | 'json';
export type SystemSettingCategory = 'operations' | 'inventory' | 'pricing' | 'ai';

type Constraints = {
  min?: number;
  max?: number;
  allowedValues?: string[];
  allowed?: readonly string[];
};

export const SYSTEM_SETTINGS_REGISTRY = {
  labor_rate: {
    label: 'Labor Rate ($/hr)',
    description: 'Default labor rate used for work orders and estimates',
    valueType: 'number',
    defaultValue: 125,
    category: 'operations',
    sensitivity: 'protected' as const,
    requiresReason: true,
    constraints: { min: 0, max: 1000 },
  },
  negative_inventory_policy: {
    label: 'Allow Negative QOH',
    description: 'Control whether negative on-hand quantities are allowed',
    valueType: 'string',
    defaultValue: 'warn',
    category: 'inventory',
    sensitivity: 'critical' as const,
    requiresReason: true,
    constraints: { allowedValues: ['warn', 'block', 'allow'], allowed: ['warn', 'block', 'allow'] as const },
  },
  inventory_enable_consumables: {
    label: 'Enable Consumables',
    description: 'Allow marking parts as consumables (tracked QOH, excluded from valuation).',
    valueType: 'boolean',
    defaultValue: false,
    category: 'inventory',
    sensitivity: 'protected' as const,
    requiresReason: false,
  },
  default_price_level: {
    label: 'Default Price Level',
    description: 'Pricing level applied when none is specified',
    valueType: 'string',
    defaultValue: 'retail',
    category: 'pricing',
    sensitivity: 'protected' as const,
    requiresReason: false,
    constraints: { allowedValues: ['retail', 'fleet', 'wholesale'], allowed: ['retail', 'fleet', 'wholesale'] as const },
  },
  minimum_margin_percent: {
    label: 'Minimum Margin %',
    description: 'Minimum acceptable margin before warnings',
    valueType: 'number',
    defaultValue: 0,
    category: 'pricing',
    sensitivity: 'critical' as const,
    requiresReason: true,
    constraints: { min: 0, max: 100 },
  },
  ai_enabled: {
    label: 'Enable Voice / AI',
    description: 'Toggle voice/AI assistance features',
    valueType: 'boolean',
    defaultValue: true,
    category: 'ai',
    sensitivity: 'protected' as const,
    riskyAction: true,
  },
  ai_confirm_risky_actions: {
    label: 'Require Confirmation for Risky Actions',
    description: 'Ask for confirmation before AI executes risky actions',
    valueType: 'boolean',
    defaultValue: true,
    category: 'ai',
    sensitivity: 'protected' as const,
    riskyAction: true,
  },
  plasma_material_cost_per_inch: {
    label: 'Plasma Cut Length Rate ($/in)',
    description: 'Charge per inch of cut length (used in plasma pricing)',
    valueType: 'number',
    defaultValue: plasmaPricingDefaults.materialCostPerInch,
    category: 'pricing',
    sensitivity: 'critical' as const,
    requiresReason: true,
    constraints: { min: 0, max: 1000 },
  },
  plasma_consumable_cost_per_pierce: {
    label: 'Plasma Pierces Rate ($/pierce)',
    description: 'Charge per pierce (used in plasma pricing)',
    valueType: 'number',
    defaultValue: plasmaPricingDefaults.consumableCostPerPierce,
    category: 'pricing',
    sensitivity: 'critical' as const,
    requiresReason: true,
    constraints: { min: 0, max: 1000 },
  },
  plasma_setup_rate_per_minute: {
    label: 'Plasma Setup Rate ($/min)',
    description: 'Labor rate applied to setup minutes in plasma pricing',
    valueType: 'number',
    defaultValue: plasmaPricingDefaults.setupRatePerMinute,
    category: 'pricing',
    sensitivity: 'critical' as const,
    requiresReason: true,
    constraints: { min: 0, max: 1000 },
  },
  plasma_machine_rate_per_minute: {
    label: 'Plasma Machine Rate ($/min)',
    description: 'Labor rate applied to machine minutes in plasma pricing',
    valueType: 'number',
    defaultValue: plasmaPricingDefaults.machineRatePerMinute,
    category: 'pricing',
    sensitivity: 'critical' as const,
    requiresReason: true,
    constraints: { min: 0, max: 1000 },
  },
} as const;

export type SystemSettingKey = keyof typeof SYSTEM_SETTINGS_REGISTRY;
