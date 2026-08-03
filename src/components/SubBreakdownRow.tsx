import { SubBreakdown } from '@/types/grades';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/NumberInput';
import { formatGrade } from '@/lib/gradeFormatting';
import { Trash2 } from 'lucide-react';

interface SubBreakdownRowProps {
  subBreakdown: SubBreakdown;
  canDelete: boolean;
  onUpdate: (updates: Partial<SubBreakdown>) => void;
  onDelete: () => void;
}

export function SubBreakdownRow({
  subBreakdown,
  canDelete,
  onUpdate,
  onDelete,
}: SubBreakdownRowProps) {
  const { achievedMarks, fullMarks } = subBreakdown;

  const handleAchievedChange = (value: string) => {
    if (value === '') {
      onUpdate({ achievedMarks: null });
      return;
    }
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) onUpdate({ achievedMarks: parsed });
  };

  const handleFullMarksChange = (value: string) => {
    const parsed = parseFloat(value);
    onUpdate({ fullMarks: isNaN(parsed) ? 0 : parsed });
  };

  // Shown so the marks-based total stays checkable at a glance.
  const percentage =
    achievedMarks !== null && fullMarks > 0 ? (achievedMarks / fullMarks) * 100 : null;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-secondary/50 animate-fade-in">
      <Input
        value={subBreakdown.name}
        onChange={e => onUpdate({ name: e.target.value })}
        className="flex-1 h-8 text-sm bg-card border-border"
        placeholder="Sub-breakdown name"
      />
      <div className="flex items-center gap-1.5">
        <NumberInput
          min={0}
          max={fullMarks}
          value={achievedMarks ?? ''}
          onChange={e => handleAchievedChange(e.target.value)}
          className="w-20 h-8 text-sm text-center font-mono bg-card border-border"
          placeholder="—"
          aria-label="Marks achieved"
        />
        <span className="text-xs text-muted-foreground">/</span>
        <NumberInput
          min={0}
          value={fullMarks}
          onChange={e => handleFullMarksChange(e.target.value)}
          className="w-20 h-8 text-sm text-center font-mono bg-card border-border"
          aria-label="Full marks"
        />
      </div>
      <span className="w-14 text-right text-xs font-mono text-muted-foreground tabular-nums">
        {percentage !== null ? `${formatGrade(percentage)}%` : ''}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={!canDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
