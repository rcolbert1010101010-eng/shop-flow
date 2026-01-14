import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { cn } from '@/lib/utils';
import type { TableDensity } from '@/stores/uiPrefsStore';

export function TableDensitySelect({ className }: { className?: string }) {
  const { tableDensity, setTableDensity } = useUiPrefs();

  const options: { value: TableDensity; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
  ];

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span>Density</span>
      <Select
        defaultValue={tableDensity}
        onValueChange={(value) => setTableDensity(value as TableDensity)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Density" />
        </SelectTrigger>
        <SelectContent align="start">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
