import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart2, ClipboardList, FileText, Package, ShieldCheck, ShoppingCart, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePermissions } from '@/security/usePermissions';
import { useToast } from '@/hooks/use-toast';

type ReportTile = {
  key: string;
  title: string;
  description: string;
  category: 'Operations' | 'Sales' | 'Inventory' | 'Financial/Quality';
  icon: LucideIcon;
  path?: string;
  comingSoon?: boolean;
};

const REPORTS: ReportTile[] = [
  {
    key: 'wip',
    title: 'Work In Process (WIP)',
    description: 'Open work with aging, promised dates, and assigned techs.',
    category: 'Operations',
    icon: Wrench,
    path: '/reports/work-in-process',
  },
  {
    key: 'waiting-parts',
    title: 'Work Orders Waiting on Parts',
    description: 'Blocked jobs and shortages by work order.',
    category: 'Operations',
    icon: ClipboardList,
    path: '/reports/work-orders-waiting-parts',
  },
  {
    key: 'work-orders',
    title: 'Work Orders Status & Aging',
    description: 'Status mix, totals, and aging across service work.',
    category: 'Operations',
    icon: ClipboardList,
    path: '/reports/work-orders',
  },
  {
    key: 'returns-warranty',
    title: 'Returns & Warranty',
    description: 'Aging and vendor trends across returns.',
    category: 'Operations',
    icon: ShieldCheck,
    path: '/reports/returns-warranty',
  },
  {
    key: 'sales-orders',
    title: 'Sales Orders Summary',
    description: 'Revenue and backlog across counter sales.',
    category: 'Sales',
    icon: ShoppingCart,
    path: '/reports/sales-orders',
  },
  {
    key: 'low-stock',
    title: 'Low Stock Parts',
    description: 'Parts at or below min with vendor/category context.',
    category: 'Inventory',
    icon: Package,
    path: '/reports/low-stock',
  },
  {
    key: 'technician-utilization',
    title: 'Technician Utilization',
    description: 'Capacity, clocked hours, and billable ratios.',
    category: 'Operations',
    icon: FileText,
    comingSoon: true,
  },
  {
    key: 'profitability',
    title: 'Work Order Profitability',
    description: 'Margin trends by job type and customer segment.',
    category: 'Financial/Quality',
    icon: BarChart2,
    comingSoon: true,
  },
  {
    key: 'quality',
    title: 'Quality & Comebacks',
    description: 'Track rework, warranty callbacks, and QA flags.',
    category: 'Financial/Quality',
    icon: ShieldCheck,
    comingSoon: true,
  },
];

export default function ReportsHome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, isReady } = usePermissions();
  const canViewReports = can('reports.view');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isReady) return;
    if (!canViewReports) {
      toast({
        title: "You don't have permission to view reports.",
        variant: 'destructive',
      });
      navigate('/', { replace: true });
    }
  }, [canViewReports, isReady, navigate, toast]);

  const filteredReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return REPORTS;
    return REPORTS.filter((report) =>
      `${report.title} ${report.description}`.toLowerCase().includes(term)
    );
  }, [query]);

  const categories: ReportTile['category'][] = ['Operations', 'Sales', 'Inventory', 'Financial/Quality'];

  if (!isReady) return null;
  if (isReady && !canViewReports) return null;

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Reports"
        description="Operational, sales, and financial snapshots to keep the floor on track."
      />

      <div className="flex items-center justify-between gap-3 no-print">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports..."
          className="max-w-md"
        />
      </div>

      <div className="space-y-6">
        {filteredReports.length === 0 && (
          <p className="text-sm text-muted-foreground">No reports match that search.</p>
        )}
        {categories.map((category) => {
          const items = filteredReports.filter((report) => report.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{category}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((report) => {
                  const Icon = report.icon;
                  const cardContent = (
                    <Card
                      className={`h-full transition hover:shadow-md ${
                        report.comingSoon ? 'opacity-70' : 'cursor-pointer'
                      }`}
                    >
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <CardTitle className="text-base">{report.title}</CardTitle>
                        </div>
                        {report.comingSoon && <Badge variant="secondary">Coming soon</Badge>}
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{report.description}</CardDescription>
                      </CardContent>
                    </Card>
                  );

                  return report.path && !report.comingSoon ? (
                    <Link key={report.key} to={report.path} className="h-full block">
                      {cardContent}
                    </Link>
                  ) : (
                    <div key={report.key} className="h-full">
                      {cardContent}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
