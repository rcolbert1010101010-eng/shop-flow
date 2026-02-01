import {
  LayoutDashboard,
  Users,
  Truck,
  Wrench,
  ShoppingCart,
  Package,
  Building2,
  Tags,
  Settings,
  HardHat,
  ClipboardList,
  ListChecks,
  BarChart2,
  Flame,
  Calendar,
  CalendarCheck,
  CreditCard,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Capability } from '@/security/rbac';

export type NavLink = { type: 'link'; path: string; label: string; icon: LucideIcon };
export type NavGroup = {
  type: 'group';
  key: 'serviceOrders' | 'inventory' | 'returnsWarranty' | 'purchaseOrders';
  label: string;
  icon: LucideIcon;
  children: NavLink[];
};
export type NavItem = NavLink | NavGroup;
export type NavSection = { label: string; items: NavItem[] };

const dashboardLink: NavLink = { type: 'link', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };
const customersLink: NavLink = { type: 'link', path: '/customers', label: 'Customers', icon: Users };
const salesOrdersLink: NavLink = { type: 'link', path: '/sales-orders', label: 'Sales Orders', icon: ShoppingCart };
const serviceGroup: NavGroup = {
  type: 'group',
  key: 'serviceOrders',
  label: 'Service',
  icon: ClipboardList,
  children: [
    { type: 'link', path: '/work-orders', label: 'Work Orders', icon: Wrench },
    { type: 'link', path: '/units', label: 'Units', icon: Truck },
    { type: 'link', path: '/unit-types', label: 'Unit Types', icon: Tags },
    { type: 'link', path: '/technicians', label: 'Technicians', icon: HardHat },
    { type: 'link', path: '/plasma', label: 'Plasma Projects', icon: Flame },
    { type: 'link', path: '/plasma/templates', label: 'Plasma Templates', icon: Flame },
  ],
};
const inventoryGroup: NavGroup = {
  type: 'group',
  key: 'inventory',
  label: 'Inventory',
  icon: Package,
  children: [
    { type: 'link', path: '/inventory', label: 'Parts', icon: Package },
    { type: 'link', path: '/vendors', label: 'Vendors', icon: Building2 },
    { type: 'link', path: '/categories', label: 'Categories', icon: Tags },
    { type: 'link', path: '/cycle-counts', label: 'Cycle Counts', icon: ListChecks },
  ],
};
const purchaseOrdersGroup: NavGroup = {
  type: 'group',
  key: 'purchaseOrders',
  label: 'Purchase Orders',
  icon: ClipboardList,
  children: [
    { type: 'link', path: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
    { type: 'link', path: '/receiving', label: 'Receiving', icon: ClipboardList },
    { type: 'link', path: '/receiving-history', label: 'Receiving History', icon: ClipboardList },
  ],
};
const schedulingLink: NavLink = { type: 'link', path: '/scheduling', label: 'Scheduling', icon: Calendar };
const plannerLink: NavLink = { type: 'link', path: '/planner', label: 'Planner', icon: CalendarCheck };
const invoicesLink: NavLink = { type: 'link', path: '/invoices', label: 'Invoices', icon: FileText };
const paymentsLink: NavLink = { type: 'link', path: '/payments', label: 'Payments', icon: CreditCard };
const usersLink: NavLink = { type: 'link', path: '/users', label: 'Users', icon: Users };
const returnsWarrantyGroup: NavGroup = {
  type: 'group',
  key: 'returnsWarranty',
  label: 'Returns & Warranty',
  icon: BarChart2,
  children: [
    { type: 'link', path: '/returns', label: 'Returns', icon: BarChart2 },
    { type: 'link', path: '/warranty', label: 'Warranty Claims', icon: BarChart2 },
    { type: 'link', path: '/reports/returns-warranty', label: 'Returns/Warranty Report', icon: BarChart2 },
  ],
};
const reportsLink: NavLink = { type: 'link', path: '/reports', label: 'Reports', icon: BarChart2 };
const settingsLink: NavLink = { type: 'link', path: '/settings', label: 'Settings', icon: Settings };

export const navSections: NavSection[] = [
  { label: 'Dashboard', items: [dashboardLink] },
  { label: 'Customers', items: [customersLink] },
  { label: 'Sales', items: [salesOrdersLink] },
  { label: 'Service', items: [serviceGroup] },
  { label: 'Inventory', items: [inventoryGroup] },
  { label: 'Purchasing', items: [purchaseOrdersGroup] },
  { label: 'Scheduling', items: [schedulingLink, plannerLink] },
  { label: 'Accounting', items: [invoicesLink, paymentsLink, returnsWarrantyGroup] },
  { label: 'Reports', items: [reportsLink] },
  { label: 'Admin', items: [usersLink, settingsLink] },
];

export const navItems: NavItem[] = navSections.flatMap((section) => section.items);

function requiredCapabilityForPath(path: string): Capability | null {
  if (path === '/payments' || path.startsWith('/payments/')) return 'payments.record';
  if (path === '/reports' || path.startsWith('/reports')) return 'reports.view';
  if (path === '/receiving' || path.startsWith('/receiving/')) return 'inventory.receive';
  if (path === '/receiving-history' || path.startsWith('/receiving-history/')) return 'inventory.receive';
  if (path === '/users' || path.startsWith('/users')) return 'admin.users';
  return null;
}

export function getFilteredNavSections(can: (cap: Capability) => boolean): NavSection[] {
  return navSections
    .map((section) => {
      const filteredItems: NavItem[] = section.items
        .map((item) => {
          if (item.type === 'link') {
            const req = requiredCapabilityForPath(item.path);
            return !req || can(req) ? item : null;
          }

          const filteredChildren = item.children.filter((child) => {
            const req = requiredCapabilityForPath(child.path);
            return !req || can(req);
          });

          return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
        })
        .filter(Boolean) as NavItem[];

      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);
}
