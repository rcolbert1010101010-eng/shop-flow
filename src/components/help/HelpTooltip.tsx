import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center text-muted-foreground cursor-help', className)}>
            <Info className="h-3.5 w-3.5 ml-1" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[240px]">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
