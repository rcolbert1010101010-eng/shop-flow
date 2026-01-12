import { useIsMobile } from '@/hooks/useIsMobile';
import type { ReactNode } from 'react';

type MobileActionBarProps = {
  primary?: ReactNode;
  secondary?: ReactNode;
};

export function MobileActionBar({ primary, secondary }: MobileActionBarProps) {
  const isMobile = useIsMobile();
  if (!isMobile || (!primary && !secondary)) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 flex items-center justify-between gap-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex-1 flex items-center gap-2">{secondary}</div>
      <div className="flex-1 flex justify-end gap-2">{primary}</div>
    </div>
  );
}

export function MobileActionBarSpacer() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <div
      className="h-16"
      style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      aria-hidden="true"
    />
  );
}
