import { useState } from 'react';
import { AdvancedOption } from '@/types/grades';
import {
  DEFAULT_DOWNWEIGHT_COUNT,
  DEFAULT_DOWNWEIGHT_PERCENT,
  DEFAULT_DROP_LOWEST_COUNT,
  GradingPolicy,
  advancedOptionUpdate,
  clampPercent,
  getActiveAdvancedOption,
} from '@/lib/gradePolicies';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/NumberInput';

interface AdvancedOptionsProps {
  policy: GradingPolicy;
  onChange: (policy: GradingPolicy) => void;
}

/**
 * The grading-policy switches, as a controlled field group.
 *
 * Works on a bare `GradingPolicy` rather than a whole breakdown, so the same
 * component drives the draft in "Add breakdown" and the draft in the advanced
 * options dialog. It holds no grading rules of its own — everything comes from
 * `gradePolicies`, which the calculator reads too.
 */
export function AdvancedOptions({ policy, onChange }: AdvancedOptionsProps) {
  const activeOption = getActiveAdvancedOption(policy);

  /**
   * Whether the full-credit row is showing its input.
   *
   * This is the one piece of local state here, and it exists because the policy
   * can't express "switched on, no threshold yet": `fullCreditGrade === null` is
   * exactly what "off" means. Seeded from the policy, so an existing threshold
   * shows up switched on.
   */
  const [fullCreditEnabled, setFullCreditEnabled] = useState(policy.fullCreditGrade !== null);

  // Turning a marks policy on clears the other; turning it off falls back to
  // 'none'. Spread over the existing policy so full credit survives the switch.
  const toggleOption = (option: AdvancedOption) => (enabled: boolean) =>
    onChange({ ...policy, ...advancedOptionUpdate(enabled ? option : 'none') });

  const setField = (field: keyof GradingPolicy, value: number | null) =>
    onChange({ ...policy, [field]: value });

  const toggleFullCredit = (enabled: boolean) => {
    setFullCreditEnabled(enabled);
    // Switching on leaves the field blank — there is nothing to commit until a
    // threshold is typed, and a blank threshold correctly applies no scaling.
    if (!enabled) setField('fullCreditGrade', null);
  };

  const handleFullCreditChange = (raw: string) => {
    if (raw === '') {
      setField('fullCreditGrade', null);
      return;
    }
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) setField('fullCreditGrade', clampPercent(parsed));
  };

  return (
    <div className="space-y-4">
      {/* Drop Lowest */}
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2 min-w-[160px]">
          <Switch
            checked={activeOption === 'dropLowest'}
            onCheckedChange={toggleOption('dropLowest')}
            disabled={activeOption === 'downweight'}
            aria-label="Drop lowest"
          />
          <Label className="text-sm font-medium">Drop Lowest</Label>
        </div>
        {activeOption === 'dropLowest' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Label className="text-sm text-muted-foreground">Drop</Label>
            <NumberInput
              min={1}
              value={policy.dropLowestCount ?? DEFAULT_DROP_LOWEST_COUNT}
              onChange={e =>
                setField('dropLowestCount', parseInt(e.target.value) || DEFAULT_DROP_LOWEST_COUNT)
              }
              className="w-16 h-8 text-center"
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
            checked={activeOption === 'downweight'}
            onCheckedChange={toggleOption('downweight')}
            disabled={activeOption === 'dropLowest'}
            aria-label="Downweight lowest"
          />
          <Label className="text-sm font-medium">Downweight</Label>
        </div>
        {activeOption === 'downweight' && (
          <div className="flex items-center gap-2 flex-wrap animate-fade-in">
            <Label className="text-sm text-muted-foreground">Reduce</Label>
            <NumberInput
              min={1}
              value={policy.downweightLowestCount ?? DEFAULT_DOWNWEIGHT_COUNT}
              onChange={e =>
                setField(
                  'downweightLowestCount',
                  parseInt(e.target.value) || DEFAULT_DOWNWEIGHT_COUNT
                )
              }
              className="w-16 h-8 text-center"
              aria-label="Number to downweight"
            />
            <Label className="text-sm text-muted-foreground">lowest by</Label>
            <NumberInput
              min={0}
              max={100}
              value={policy.downweightPercent ?? DEFAULT_DOWNWEIGHT_PERCENT}
              onChange={e =>
                setField('downweightPercent', clampPercent(parseInt(e.target.value) || 0))
              }
              className="w-16 h-8 text-center"
              aria-label="Downweight percentage"
            />
            <Label className="text-sm text-muted-foreground">%</Label>
          </div>
        )}
      </div>

      {/*
        Full credit is not part of the mutually-exclusive pair above — it scales
        whatever percentage they produce, so it composes with either. Hence no
        `disabled` here.
      */}
      <div className="flex items-start gap-4 pt-1 border-t border-border">
        <div className="flex items-center gap-2 min-w-[160px] pt-3">
          <Switch
            checked={fullCreditEnabled}
            onCheckedChange={toggleFullCredit}
            aria-label="Full credit grade"
          />
          <Label className="text-sm font-medium">Full Credit</Label>
        </div>
        {fullCreditEnabled && (
          <div className="flex items-center gap-2 pt-3 animate-fade-in">
            <NumberInput
              min={0}
              max={100}
              value={policy.fullCreditGrade ?? ''}
              onChange={e => handleFullCreditChange(e.target.value)}
              className="w-16 h-8 text-center"
              placeholder="—"
              aria-label="Full credit percentage"
            />
            <Label className="text-sm text-muted-foreground">% earns full credit</Label>
          </div>
        )}
      </div>
    </div>
  );
}
