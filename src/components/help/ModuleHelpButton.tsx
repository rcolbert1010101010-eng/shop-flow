import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { HelpDrawer } from './HelpDrawer';
import type { HelpContext } from '@/help/types';
import { usePermissions } from '@/security/usePermissions';
import type { Role } from '@/security/rbac';

function mapRoleToHelpRole(role: Role | undefined) {
  if (role === 'ADMIN' || role === 'MANAGER') return 'Manager/Admin' as const;
  if (role === 'SERVICE_WRITER') return 'Service Writer' as const;
  return 'Technician' as const;
}

interface ModuleHelpButtonProps {
  moduleKey: string;
  label?: string;
  context?: HelpContext;
}

export function ModuleHelpButton({ moduleKey, label = 'Help', context }: ModuleHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const { role } = usePermissions();
  const helpRole = useMemo(() => mapRoleToHelpRole(role), [role]);
  const mergedContext = useMemo(
    () => ({ ...context, userRole: helpRole }),
    [context, helpRole]
  );

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
      <HelpDrawer moduleKey={moduleKey} open={open} onOpenChange={setOpen} context={mergedContext} />
    </>
  );
}
