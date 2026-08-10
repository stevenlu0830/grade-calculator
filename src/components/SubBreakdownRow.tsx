import { useState } from 'react';
import { SubBreakdown } from '@/types/grades';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { achievedMarks, fullMarks } = subBreakdown;

  /** Blank clears the value; anything unparseable is ignored rather than corrected. */
  const parseEntry = (value: string): number | null | undefined => {
    if (value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  const handleAchievedChange = (value: string) => {
    const next = parseEntry(value);
    if (next !== undefined) onUpdate({ achievedMarks: next });
  };

  const handleFullMarksChange = (value: string) => {
    const next = parseEntry(value);
    if (next !== undefined) onUpdate({ fullMarks: next });
  };

  /** Worth spelling out before deleting: an unmarked row loses nothing. */
  const hasMarks = achievedMarks !== null && fullMarks !== null;

  // Shown so the marks-based total stays checkable at a glance. Can exceed 100%
  // when bonus marks are awarded.
  const percentage =
    achievedMarks !== null && fullMarks !== null && fullMarks > 0
      ? (achievedMarks / fullMarks) * 100
      : null;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-secondary/50 animate-fade-in">
      <Input
        value={subBreakdown.name}
        onChange={e => onUpdate({ name: e.target.value })}
        className="flex-1 h-8 text-sm bg-card border-border"
        placeholder="Sub-breakdown name"
      />
      <div className="flex items-center gap-1.5">
        {/* No `max`: a score above full marks is a valid bonus, not an error. */}
        <NumberInput
          value={achievedMarks ?? ''}
          onChange={e => handleAchievedChange(e.target.value)}
          className="w-20 h-8 text-sm text-center font-mono bg-card border-border"
          placeholder="—"
          aria-label="Marks achieved"
        />
        <span className="text-xs text-muted-foreground">/</span>
        <NumberInput
          value={fullMarks ?? ''}
          onChange={e => handleFullMarksChange(e.target.value)}
          className="w-20 h-8 text-sm text-center font-mono bg-card border-border"
          placeholder="—"
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
        onClick={() => setConfirmDeleteOpen(true)}
        disabled={!canDelete}
        aria-label="Delete sub-breakdown"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${subBreakdown.name.trim() || 'this sub-breakdown'}?`}
        description={
          hasMarks
            ? `This row is marked ${achievedMarks} out of ${fullMarks}. Deleting it removes that score from the breakdown, and cannot be undone.`
            : 'Deleting this row cannot be undone.'
        }
        confirmLabel="Delete row"
        onConfirm={onDelete}
      />
    </div>
  );
}
