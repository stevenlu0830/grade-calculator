import { PolicyDraft } from '@/lib/gradePolicies';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/NumberInput';

interface AdvancedOptionsProps {
  draft: PolicyDraft;
  onChange: (draft: PolicyDraft) => void;
}

/**
 * The grading-policy switches, as a controlled field group.
 *
 * Works on a `PolicyDraft` rather than a whole breakdown, so the same component
 * drives the draft in "Add breakdown" and the draft in the advanced options
 * dialog. It holds no state and no grading rules of its own — the draft's shape
 * comes from `gradePolicies`, which the calculator reads too.
 *
 * Every number here is raw text, so a field can be emptied and retyped. The
 * parents check for blanks on submit via `policyDraftErrors`; nothing is
 * corrected or defaulted while the student is still typing.
 */
export function AdvancedOptions({ draft, onChange }: AdvancedOptionsProps) {
  const setField = <K extends keyof PolicyDraft>(field: K, value: PolicyDraft[K]) =>
    onChange({ ...draft, [field]: value });

  return (
    <div className="space-y-4">
      {/* Drop Lowest */}
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2 min-w-[160px]">
          <Switch
            checked={draft.dropLowest}
            onCheckedChange={enabled => setField('dropLowest', enabled)}
            disabled={draft.downweight}
            aria-label="Drop lowest"
          />
          <Label className="text-sm font-medium">Drop Lowest</Label>
        </div>
        {draft.dropLowest && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Label className="text-sm text-muted-foreground">Drop</Label>
            <NumberInput
              min={1}
              value={draft.dropLowestCount}
              onChange={e => setField('dropLowestCount', e.target.value)}
              className="w-16 h-8 text-center"
              placeholder="—"
              aria-label="Number to drop"
            />
            <Label className="text-sm text-muted-foreground">lowest</Label>
          </div>
        )}
      </div>

      {/* Downweight Lowest */}
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2 min-w-[160px]">
          <Switch
            checked={draft.downweight}
            onCheckedChange={enabled => setField('downweight', enabled)}
            disabled={draft.dropLowest}
            aria-label="Downweight lowest"
          />
          <Label className="text-sm font-medium">Downweight</Label>
        </div>
        {draft.downweight && (
          <div className="flex items-center gap-2 flex-wrap animate-fade-in">
            <Label className="text-sm text-muted-foreground">Reduce</Label>
            <NumberInput
              min={1}
              value={draft.downweightLowestCount}
              onChange={e => setField('downweightLowestCount', e.target.value)}
              className="w-16 h-8 text-center"
              placeholder="—"
              aria-label="Number to downweight"
            />
            <Label className="text-sm text-muted-foreground">lowest by</Label>
            <NumberInput
              min={0}
              max={100}
              value={draft.downweightPercent}
              onChange={e => setField('downweightPercent', e.target.value)}
              className="w-16 h-8 text-center"
              placeholder="—"
              aria-label="Downweight percentage"
            />
            <Label className="text-sm text-muted-foreground">%</Label>
          </div>
        )}
      </div>

      {/*
        Equal weight changes what marks the options above are working from, not
        which of them applies, so it composes with all of them.
      */}
      <div className="flex items-start gap-4 pt-1 border-t border-border">
        <div className="flex items-center gap-2 min-w-[160px] pt-3">
          <Switch
            checked={draft.equalWeight}
            onCheckedChange={enabled => setField('equalWeight', enabled)}
            aria-label="Equal weight"
          />
          <Label className="text-sm font-medium">Equal Weight</Label>
        </div>
        <p className="pt-3 text-sm text-muted-foreground">
          Every sub-breakdown counts the same, even when they're out of different full marks — so
          8/10 and 40/50 both count as 80%.
        </p>
      </div>

      {/*
        Full credit is not part of the mutually-exclusive pair above — it scales
        whatever percentage they produce, so it composes with either. Hence no
        `disabled` here.
      */}
      <div className="flex items-start gap-4 pt-1 border-t border-border">
        <div className="flex items-center gap-2 min-w-[160px] pt-3">
          <Switch
            checked={draft.fullCredit}
            onCheckedChange={enabled => setField('fullCredit', enabled)}
            aria-label="Full credit grade"
          />
          <Label className="text-sm font-medium">Full Credit</Label>
        </div>
        {draft.fullCredit && (
          <div className="flex items-center gap-2 pt-3 animate-fade-in">
            <NumberInput
              min={0}
              max={100}
              value={draft.fullCreditGrade}
              onChange={e => setField('fullCreditGrade', e.target.value)}
              className="w-16 h-8 text-center"
              placeholder="—"
              aria-label="Full credit percentage"
            />
            <Label className="text-sm text-muted-foreground">% earns full credit</Label>
          </div>
        )}
      </div>

      {/* Bonus changes what the weight means, so it stands apart from the rest. */}
      <div className="flex items-start gap-4 pt-1 border-t border-border">
        <div className="flex items-center gap-2 min-w-[160px] pt-3">
          <Switch
            checked={draft.isBonus}
            onCheckedChange={enabled => setField('isBonus', enabled)}
            aria-label="Bonus grade"
          />
          <Label className="text-sm font-medium">Bonus Grade</Label>
        </div>
        <p className="pt-3 text-sm text-muted-foreground">
          Counts towards the final grade, but not towards the 100% the course is out of.
        </p>
      </div>
    </div>
  );
}
