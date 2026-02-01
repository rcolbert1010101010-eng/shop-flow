import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { docMetaByModuleKey } from '@/help/docsRegistry';

const labelOverrides: Record<string, string> = {
  plasma_projects: 'Plasma Projects',
  plasma_templates: 'Plasma Templates',
  returns_warranty_report: 'Returns & Warranty Report',
  receiving_history: 'Receiving History',
  warranty_returns: 'Warranty & Returns',
  part_categories: 'Part Categories',
  cycle_counts: 'Cycle Counts',
  sales_orders: 'Sales Orders',
  work_orders: 'Work Orders',
  purchase_orders: 'Purchase Orders',
};

const toTitle = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export default function DocsHome() {
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return Object.entries(docMetaByModuleKey)
      .map(([key, meta]) => {
        const label = meta.title || labelOverrides[key] || toTitle(key);
        return { key, path: meta.path, label, updatedAt: meta.updatedAt };
      })
      .filter((entry) =>
        normalizedQuery ? entry.label.toLowerCase().includes(normalizedQuery) : true
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [query]);

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Documentation" backTo="/dashboard" />

      <div className="max-w-md">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documentation..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <Link key={entry.key} to={entry.path} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="text-base">{entry.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div>Open the {entry.label} documentation.</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Last updated: {entry.updatedAt}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {entries.length === 0 && (
          <div className="text-sm text-muted-foreground">No documentation matches your search.</div>
        )}
      </div>
    </div>
  );
}
