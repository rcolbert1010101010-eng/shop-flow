import { useIsMobile } from '@/hooks/useIsMobile';
import type { ReactNode } from 'react';

type ResponsiveDataListProps<T> = {
  items: T[];
  renderMobileCard: (item: T) => ReactNode;
  renderDesktop: (items: T[]) => ReactNode;
};

export function ResponsiveDataList<T>({ items, renderMobileCard, renderDesktop }: ResponsiveDataListProps<T>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
            {renderMobileCard(item)}
          </div>
        ))}
      </div>
    );
  }

  return <>{renderDesktop(items)}</>;
}
