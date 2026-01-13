import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  backTo?: string;
  description?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, breadcrumbs, backTo, description }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex flex-col gap-2">
        {breadcrumbs && <div className="text-xs text-muted-foreground flex items-center gap-2">{breadcrumbs}</div>}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            {backTo && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(backTo)}
                className="mt-0.5"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl font-semibold text-foreground leading-tight break-words">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              {description && <div className="text-xs text-muted-foreground">{description}</div>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center justify-end gap-2 no-print">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
