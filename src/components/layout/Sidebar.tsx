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

type NavLink = { type: 'link'; path: string; label: string; icon: LucideIcon };
type NavGroup = {
  type: 'group';
  key: 'serviceOrders' | 'inventory' | 'returnsWarranty' | 'manufacturing';
  label: string;
  icon: LucideIcon;
  children: NavLink[];
};
type NavItem = NavLink | NavGroup;

const navItems: NavItem[] = [
  { type: 'link', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'link', path: '/customers', label: 'Customers', icon: Users },
  { type: 'link', path: '/scheduling', label: 'Scheduling', icon: Calendar },
  { type: 'link', path: '/sales-orders', label: 'Sales Orders', icon: ShoppingCart },
  { type: 'link', path: '/invoices', label: 'Invoices', icon: FileText },
  { type: 'link', path: '/payments', label: 'Payments', icon: CreditCard },
  { type: 'link', path: '/reports', label: 'Reports', icon: BarChart2 },
  {
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
  },
  {
    type: 'group',
    key: 'inventory',
    label: 'Inventory',
    icon: Package,
    children: [
      { type: 'link', path: '/inventory', label: 'Parts', icon: Package },
      { type: 'link', path: '/receiving', label: 'Receiving', icon: ClipboardList },
      { type: 'link', path: '/receiving-history', label: 'Receiving History', icon: ClipboardList },
      { type: 'link', path: '/vendors', label: 'Vendors', icon: Building2 },
      { type: 'link', path: '/categories', label: 'Categories', icon: Tags },
      { type: 'link', path: '/cycle-counts', label: 'Cycle Counts', icon: ListChecks },
    ],
  },
  {
    type: 'group',
    key: 'manufacturing',
    label: 'Manufacturing',
    icon: Factory,
    children: [
      { type: 'link', path: '/manufacturing/products', label: 'Products', icon: Package },
      { type: 'link', path: '/manufacturing/builds', label: 'Builds', icon: Layers },
    ],
  },
  { type: 'link', path: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  {
    type: 'group',
    key: 'returnsWarranty',
    label: 'Returns & Warranty',
    icon: BarChart2,
    children: [
      { type: 'link', path: '/returns', label: 'Returns', icon: BarChart2 },
      { type: 'link', path: '/warranty', label: 'Warranty Claims', icon: BarChart2 },
      { type: 'link', path: '/reports/returns-warranty', label: 'Returns/Warranty Report', icon: BarChart2 },
    ],
  },
  { type: 'link', path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [darkSidebar, setDarkSidebar] = useState(true);
  const [openSection, setOpenSection] = useState<NavGroup['key'] | null>(null);

  const sidebarColors = darkSidebar
    ? {
        bg: 'bg-[hsl(222,22%,8%)]',
        border: 'border-[hsl(222,15%,20%)]',
        text: 'text-[hsl(0,0%,85%)]',
        textMuted: 'text-[hsl(0,0%,60%)]',
        hover: 'hover:bg-[hsl(222,20%,18%)] hover:text-[hsl(0,0%,95%)]',
        active: 'bg-primary text-primary-foreground',
      }
    : {
        bg: 'bg-card',
        border: 'border-border',
        text: 'text-foreground',
        textMuted: 'text-muted-foreground',
        hover: 'hover:bg-accent hover:text-accent-foreground',
        active: 'bg-primary text-primary-foreground',
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
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          options?.nested ? 'pl-10 text-sm' : '',
          isActive ? sidebarColors.active : cn(sidebarColors.text, sidebarColors.hover)
        )}
      >
        <item.icon className={cn('flex-shrink-0', options?.nested ? 'w-4 h-4' : 'w-5 h-5')} />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const isGroupActive = group.children.some((child) => isPathActive(child.path));

    return (
      <AccordionItem key={group.key} value={group.key} className="border-none">
        <AccordionTrigger
          className={cn(
            'px-3 py-2.5 rounded-lg flex items-center gap-3 hover:no-underline transition-all duration-200',
            isGroupActive ? sidebarColors.active : cn(sidebarColors.text, sidebarColors.hover)
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
    <>
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className={cn('font-semibold', sidebarColors.text)}>ShopPro</span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className={cn('p-1.5 rounded-md transition-colors', sidebarColors.text, sidebarColors.hover)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <Accordion
            type="single"
            collapsible
            value={openSection ?? ''}
            onValueChange={(value) => setOpenSection((value as NavGroup['key']) || null)}
            className="space-y-1"
          >
            {navItems.map((item) =>
              item.type === 'group' ? renderGroup(item) : renderLink(item)
            )}
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
    </>
  );
}
