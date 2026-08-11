import { useState } from 'react';
import { SubBreakdown } from '@/types/grades';
import { ChangeFullMarkDialog } from './ChangeFullMarkDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NumberInput } from '@/components/NumberInput';
import { formatGrade, formatMarks } from '@/lib/gradeFormatting';
import { Scale, Trash2 } from 'lucide-react';

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
  const [changeFullMarkOpen, setChangeFullMarkOpen] = useState(false);
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
    <div className="flex items-center gap-1.5 py-1 px-1.5 rounded-md bg-secondary/50 animate-fade-in">
      <Input
        value={subBreakdown.name}
        onChange={e => onUpdate({ name: e.target.value })}
        className="flex-1 min-w-0 h-7 px-2 text-xs bg-card border-border"
        placeholder="Sub-breakdown name"
      />
      <div className="flex items-center gap-1 shrink-0">
        {/* No `max`: a score above full marks is a valid bonus, not an error. */}
        <NumberInput
          value={achievedMarks ?? ''}
          onChange={e => handleAchievedChange(e.target.value)}
          className="w-14 h-7 px-1 text-xs text-center font-mono bg-card border-border"
          placeholder="—"
          aria-label="Marks achieved"
        />
        <span className="text-[10px] text-muted-foreground">/</span>
        <NumberInput
          value={fullMarks ?? ''}
          onChange={e => handleFullMarksChange(e.target.value)}
          className="w-14 h-7 px-1 text-xs text-center font-mono bg-card border-border"
          placeholder="—"
          aria-label="Full marks"
        />
      </div>
      <span className="w-12 shrink-0 text-right text-[10px] font-mono text-muted-foreground tabular-nums">
        {percentage !== null ? `${formatGrade(percentage)}%` : ''}
      </span>

      {/* Re-marking out of a different total keeps the score, which typing over
          the boxes above does not — hence its own button. Labelled by tooltip
          rather than text, so the row still fits two courses side by side. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => setChangeFullMarkOpen(true)}
            aria-label="Change full mark"
          >
            <Scale className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Change full mark</TooltipContent>
      </Tooltip>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmDeleteOpen(true)}
        disabled={!canDelete}
        aria-label="Delete sub-breakdown"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <ChangeFullMarkDialog
        open={changeFullMarkOpen}
        onOpenChange={setChangeFullMarkOpen}
        subBreakdown={subBreakdown}
        onApply={onUpdate}
      />

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${subBreakdown.name.trim() || 'this sub-breakdown'}?`}
        description={
          hasMarks
            ? `This row is marked ${formatMarks(achievedMarks)} out of ${formatMarks(
                fullMarks
              )}. Deleting it removes that score from the breakdown, and cannot be undone.`
            : 'Deleting this row cannot be undone.'
        }
        confirmLabel="Delete row"
        onConfirm={onDelete}
      />
    </div>
  );
}
