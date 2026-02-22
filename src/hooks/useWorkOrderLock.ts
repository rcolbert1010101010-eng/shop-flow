import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrderStatus } from '@/types';

export const WORK_ORDER_LOCKED_MESSAGE = 'Work Order is INVOICED and locked';

type WorkOrderLike = {
  status?: WorkOrderStatus | null;
} | null | undefined;

export const isWorkOrderLocked = (status?: WorkOrderStatus | null): boolean =>
  status === 'INVOICED';

export const useWorkOrderLock = (workOrder: WorkOrderLike) => {
  const { toast } = useToast();
  const isLocked = isWorkOrderLocked(workOrder?.status);

  const notifyLocked = useCallback(() => {
    toast({ title: WORK_ORDER_LOCKED_MESSAGE });
  }, [toast]);

  const guardLockedAction = useCallback(
    <T,>(action: () => T): T | null => {
      if (isLocked) {
        notifyLocked();
        return null;
      }
      return action();
    },
    [isLocked, notifyLocked]
  );

  return {
    isLocked,
    lockMessage: WORK_ORDER_LOCKED_MESSAGE,
    notifyLocked,
    guardLockedAction,
  };
};
