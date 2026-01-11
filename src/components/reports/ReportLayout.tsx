import { useEffect, useMemo, type ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportCsv, type CsvColumn } from '@/lib/reports/csv';

type ReportLayoutProps<T = any> = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  onExport?: () => void;
  exportConfig?: { filename: string; columns: CsvColumn<T>[]; rows: T[] };
  children: ReactNode;
  className?: string;
};

const PRINT_STYLES = `
@media print {
  body.report-print-mode aside,
  body.report-print-mode nav,
  body.report-print-mode .no-print {
    display: none !important;
  }

  body.report-print-mode .report-header {
    display: block !important;
  }

  body.report-print-mode .report-generated {
    display: block !important;
  }

  body.report-print-mode .page-container {
    padding: 0 !important;
    margin: 0 !important;
  }
}
`;

export function ReportLayout<T = any>({
  title,
  description,
  actions,
  filters,
  onExport,
  exportConfig,
  children,
  className,
}: ReportLayoutProps<T>) {
  useEffect(() => {
    document.body.classList.add('report-print-mode');
    const styleEl = document.createElement('style');
    styleEl.textContent = PRINT_STYLES;
    document.head.appendChild(styleEl);

    return () => {
      document.body.classList.remove('report-print-mode');
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);

  const generatedAt = useMemo(() => new Date(), []);
  const formattedGeneratedAt = useMemo(
    () => generatedAt.toLocaleString(),
    [generatedAt]
  );

  const handleExport = () => {
    if (onExport) {
      onExport();
      return;
    }
    if (exportConfig) {
      exportCsv(exportConfig);
    }
  };

  const showExport = Boolean(onExport || exportConfig);

  return (
    <div className={cn('page-container report-page', className)}>
      <header className="report-header">
        <PageHeader
          title={title}
          description={description}
          actions={
            <div className="flex flex-wrap items-center gap-2 no-print">
              {actions}
              {showExport && (
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          }
        />
      </header>

      {filters && (
        <Card className="p-4 no-print">
          <div className="flex flex-wrap gap-3 items-center">{filters}</div>
        </Card>
      )}

      <div className="report-generated text-xs text-muted-foreground print:text-black">
        Generated on {formattedGeneratedAt}
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  );
}
