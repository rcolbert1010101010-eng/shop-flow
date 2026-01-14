import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { HelpDrawer } from './HelpDrawer';
import type { HelpContext } from '@/help/types';

interface ModuleHelpButtonProps {
  moduleKey: string;
  label?: string;
  context?: HelpContext;
}

export function ModuleHelpButton({ moduleKey, label = 'Help', context }: ModuleHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <HelpCircle className="w-4 h-4" />
        {label}
      </Button>
      <HelpDrawer moduleKey={moduleKey} open={open} onOpenChange={setOpen} context={context} />
    </>
  );
}
