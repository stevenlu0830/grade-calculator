import { useState } from 'react';
import { SubBreakdown } from '@/types/grades';
import { rescaleAchievedMarks } from '@/lib/gradeCalculations';
import { formatGrade, formatMarks } from '@/lib/gradeFormatting';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/NumberInput';
import { AlertTriangle } from 'lucide-react';

interface ChangeFullMarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subBreakdown: SubBreakdown;
  onApply: (updates: Partial<SubBreakdown>) => void;
}

/**
 * Restates one sub-breakdown out of a different number of marks.
 *
 * A course that remarks an assignment out of 20 instead of 10 hasn't changed
 * what the student scored, so the mark achieved is scaled to keep its
 * percentage: 8/10 becomes 16/20. Typing over the two boxes in the row does the
 * other thing — it changes the score — which is why this needs to be its own
 * action rather than an edit to the full-marks field.
 */
export function ChangeFullMarkDialog({
  open,
  onOpenChange,
  subBreakdown,
  onApply,
}: ChangeFullMarkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change full mark</DialogTitle>
          <DialogDescription>
            What {subBreakdown.name.trim() || 'this row'} is marked out of. The mark achieved is
            scaled with it, so the percentage stays the same.
          </DialogDescription>
        </DialogHeader>

        {/* Same pattern as the advanced options dialog: the draft lives in a
            child seeded at mount, and `key` remounts it whenever the dialog
            opens or closes, so Cancel genuinely discards. */}
        <ChangeFullMarkForm
          key={String(open)}
          subBreakdown={subBreakdown}
          onApply={onApply}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ChangeFullMarkFormProps {
  subBreakdown: SubBreakdown;
  onApply: (updates: Partial<SubBreakdown>) => void;
  onCancel: () => void;
}

function ChangeFullMarkForm({ subBreakdown, onApply, onCancel }: ChangeFullMarkFormProps) {
  const { achievedMarks, fullMarks } = subBreakdown;
  // Raw text, so the box can be emptied and retyped; parsed on commit.
  const [entry, setEntry] = useState(fullMarks === null ? '' : String(fullMarks));
  const [error, setError] = useState<string | null>(null);

  const parsed = entry.trim() === '' ? null : Number(entry);
  const isUsable = parsed !== null && !Number.isNaN(parsed) && parsed >= 0;
  const rescaled = isUsable ? rescaleAchievedMarks(achievedMarks, fullMarks, parsed) : null;

  const percentage =
    achievedMarks !== null && fullMarks !== null && fullMarks > 0
      ? (achievedMarks / fullMarks) * 100
      : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!isUsable) {
      setError('Enter the number of marks this is out of. It can’t be blank or negative.');
      return;
    }

    onApply({ fullMarks: parsed, achievedMarks: rescaled });
    onCancel();
  };

  return (
    // A form so Return applies.
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-full-mark">New full mark</Label>
        <NumberInput
          id="new-full-mark"
          min={0}
          value={entry}
          onChange={event => {
            setEntry(event.target.value);
            setError(null); // The complaint was about the box as it was.
          }}
          placeholder="e.g. 20"
          autoFocus
        />
      </div>

      {/* Spelled out before Apply, because scaling a mark the student didn't
          ask to change would otherwise be a surprise. */}
      <div className="rounded-md bg-secondary/50 px-3 py-2 text-sm">
        <span className="font-mono">
          {formatMarks(achievedMarks)} / {formatMarks(fullMarks)}
        </span>
        {percentage !== null && (
          <span className="text-muted-foreground"> ({formatGrade(percentage)}%)</span>
        )}
        <span className="text-muted-foreground"> becomes </span>
        {isUsable ? (
          <span className="font-mono font-medium">
            {formatMarks(rescaled)} / {formatMarks(parsed)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Nothing to scale from, so the score is left exactly as it is. */}
      {achievedMarks !== null && (fullMarks === null || fullMarks <= 0) && (
        <p className="text-xs text-muted-foreground">
          This row has no full marks to scale from, so the mark achieved is left as it is.
        </p>
      )}

      {error && (
        <Alert variant="destructive" className="bg-warning/10 border-warning">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm text-foreground">{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Apply</Button>
      </DialogFooter>
    </form>
  );
}
