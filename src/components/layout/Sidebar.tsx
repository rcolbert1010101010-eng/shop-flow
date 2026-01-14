import { Link, useLocation } from 'react-router-dom';
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
  ChevronLeft,
  Menu,
  HardHat,
  ClipboardList,
  Sun,
  Moon,
  ListChecks,
  BarChart2,
  Flame,
  Calendar,
  Factory,
  Layers,
  CreditCard,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { LucideIcon } from 'lucide-react';
import shopflowLogo from '@/assets/branding/shopflow-logo.svg';

export type NavLink = { type: 'link'; path: string; label: string; icon: LucideIcon };
export type NavGroup = {
  type: 'group';
  key: 'serviceOrders' | 'inventory' | 'returnsWarranty' | 'manufacturing' | 'purchaseOrders';
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
const manufacturingGroup: NavGroup = {
  type: 'group',
  key: 'manufacturing',
  label: 'Manufacturing',
  icon: Factory,
  children: [
    { type: 'link', path: '/manufacturing/products', label: 'Products', icon: Package },
    { type: 'link', path: '/manufacturing/builds', label: 'Builds', icon: Layers },
  ],
};
const invoicesLink: NavLink = { type: 'link', path: '/invoices', label: 'Invoices', icon: FileText };
const paymentsLink: NavLink = { type: 'link', path: '/payments', label: 'Payments', icon: CreditCard };
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
  { label: 'Scheduling', items: [schedulingLink] },
  { label: 'Manufacturing', items: [manufacturingGroup] },
  { label: 'Accounting', items: [invoicesLink, paymentsLink, returnsWarrantyGroup] },
  { label: 'Reports', items: [reportsLink] },
  { label: 'Settings', items: [settingsLink] },
];

export const navItems: NavItem[] = navSections.flatMap((section) => section.items);

export function Sidebar({ className }: { className?: string } = {}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [darkSidebar, setDarkSidebar] = useState(true);
  const [openSection, setOpenSection] = useState<NavGroup['key'] | null>(null);

  const sidebarColors = {
    bg: 'bg-[hsl(var(--sidebar-background, var(--card)))]',
    border: 'border-[hsl(var(--sidebar-border, var(--border)))]',
    text: darkSidebar ? 'text-[hsl(var(--sidebar-foreground, var(--foreground)))]' : 'text-foreground',
    textMuted: darkSidebar
      ? 'text-[hsl(var(--sidebar-foreground, var(--foreground)))/80]'
      : 'text-muted-foreground',
    hover: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  };

  const isPathActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const renderLink = (item: NavLink, options?: { nested?: boolean }) => {
    const isActive = isPathActive(item.path);

    return (
      <Link
        key={options?.nested ? `${item.path}-nested` : item.path}
        to={item.path}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 min-w-0',
          'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full',
          options?.nested ? 'pl-10 text-sm' : '',
          isActive
            ? 'bg-accent text-foreground shadow-sm before:bg-primary'
            : cn(sidebarColors.text, sidebarColors.hover, 'before:bg-transparent')
        )}
      >
        <item.icon className={cn('flex-shrink-0', options?.nested ? 'w-4 h-4' : 'w-5 h-5')} />
        <span className="font-medium whitespace-nowrap truncate">{item.label}</span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const isGroupActive = group.children.some((child) => isPathActive(child.path));

    return (
      <AccordionItem key={group.key} value={group.key} className="border-none">
        <AccordionTrigger
          className={cn(
            'relative px-3 py-2.5 rounded-lg flex items-center gap-3 hover:no-underline transition-colors duration-200',
            'before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full',
            isGroupActive
              ? 'bg-accent text-foreground shadow-sm before:bg-primary'
              : cn(sidebarColors.text, sidebarColors.hover, 'before:bg-transparent')
          )}
        >
          <div className="flex items-center gap-3">
            <group.icon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{group.label}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-1 pt-1">
          {group.children.map((child) => renderLink(child, { nested: true }))}
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className={className}>
      {/* Floating toggle when collapsed */}
      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className={cn(
            'fixed top-4 left-4 z-50 bg-card shadow-md border border-border hover:bg-accent',
            'no-print'
          )}
        >
          <Menu className="w-5 h-5" />
        </Button>
      )}

      <aside
        className={cn(
          'h-screen flex flex-col transition-all duration-300 no-print',
          sidebarColors.bg,
          sidebarColors.border,
          'border-r',
          collapsed ? 'w-0 overflow-hidden' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn('h-16 flex items-center justify-between px-4 border-b', sidebarColors.border)}>
          <div className="flex items-center gap-3">
            <img
              src={shopflowLogo}
              alt="ShopFlow"
              className="h-8 w-8 rounded-md"
            />
            <span className={cn('font-semibold', sidebarColors.text)}>ShopFlow</span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className={cn('p-1.5 rounded-md transition-colors', sidebarColors.text, sidebarColors.hover)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto sidebar-scroll">
          <Accordion
            type="single"
            collapsible
            value={openSection ?? ''}
            onValueChange={(value) => setOpenSection((value as NavGroup['key']) || null)}
            className="space-y-2"
          >
            {navSections.map((section) => (
              <div key={section.label} className="mb-2">
                <div className="space-y-1">
                  {section.items.map((item) =>
                    item.type === 'group' ? renderGroup(item) : renderLink(item)
                  )}
                </div>
              </div>
            ))}
          </Accordion>
        </nav>

        {/* Footer with Toggles */}
        <div className={cn('p-4 border-t flex items-center justify-between', sidebarColors.border)}>
          <p className={cn('text-xs', sidebarColors.textMuted)}>
            Heavy-Duty Repair
          </p>
          <div className="flex items-center gap-1">
            {/* Sidebar theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkSidebar(!darkSidebar)}
              className={cn('h-8 w-8', sidebarColors.text, sidebarColors.hover)}
              title={darkSidebar ? 'Switch to light sidebar' : 'Switch to dark sidebar'}
            >
              {darkSidebar ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {/* App theme toggle */}
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </div>
  );
}
