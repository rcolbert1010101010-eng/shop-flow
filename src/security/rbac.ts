/**
 * Role-Based Access Control (RBAC) framework for ShopFlow
 * 
 * This module defines roles, capabilities, and permission checks.
 * Currently, this is a minimal implementation without authentication.
 */

export type Role = 'ADMIN' | 'MANAGER' | 'SERVICE_WRITER' | 'PARTS' | 'TECH';

export type Capability =
  | 'settings.view'
  | 'settings.edit'
  | 'inventory.view'
  | 'inventory.adjust_qoh'
  | 'inventory.receive'
  | 'work_orders.create'
  | 'work_orders.edit'
  | 'work_orders.change_status'
  | 'work_orders.assign_tech'
  | 'reports.view'
  | 'payments.record'
  | 'invoices.create'
  | 'invoices.void';

/**
 * Maps roles to their allowed capabilities
 */
const roleCapabilities: Record<Role, Set<Capability>> = {
  ADMIN: new Set([
    'settings.view',
    'settings.edit',
    'inventory.view',
    'inventory.adjust_qoh',
    'inventory.receive',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.change_status',
    'work_orders.assign_tech',
    'reports.view',
    'payments.record',
    'invoices.create',
    'invoices.void',
  ]),

  MANAGER: new Set([
    'settings.view',
    // Note: settings.edit is ADMIN only for v1
    'inventory.view',
    'inventory.adjust_qoh',
    'inventory.receive',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.change_status',
    'work_orders.assign_tech',
    'reports.view',
    'payments.record',
    'invoices.create',
    'invoices.void',
  ]),

  SERVICE_WRITER: new Set([
    'settings.view',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.change_status',
    'work_orders.assign_tech',
    'invoices.create',
    'payments.record',
    'reports.view',
    // No inventory.adjust_qoh
    // No invoices.void
  ]),

  PARTS: new Set([
    'settings.view',
    'inventory.view',
    'inventory.receive',
    // No settings.edit
    // No inventory.adjust_qoh
    // No invoices.void
  ]),

  TECH: new Set([
    'settings.view',
    'work_orders.create',
    'work_orders.edit',
    'work_orders.change_status',
    // No settings.edit
    // No financial actions (payments, invoices)
  ]),
};

/**
 * Checks if a role has a specific capability
 */
export function can(role: Role, capability: Capability): boolean {
  const capabilities = roleCapabilities[role];
  if (!capabilities) {
    return false;
  }
  return capabilities.has(capability);
}

/**
 * Returns a user-friendly display name for a role
 */
export function roleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    ADMIN: 'Administrator',
    MANAGER: 'Manager',
    SERVICE_WRITER: 'Service Writer',
    PARTS: 'Parts',
    TECH: 'Technician',
  };
  return displayNames[role] || role;
}
