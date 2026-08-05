import { AdvancedOption } from '@/types/grades';
import {
  DEFAULT_DOWNWEIGHT_COUNT,
  DEFAULT_DOWNWEIGHT_PERCENT,
  DEFAULT_DROP_LOWEST_COUNT,
  DEFAULT_FULL_CREDIT_GRADE,
  GradingPolicy,
  advancedOptionUpdate,
  clampPercent,
  getActiveAdvancedOption,
} from '@/lib/gradePolicies';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/NumberInput';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface AdvancedOptionsProps {
  policy: GradingPolicy;
  onChange: (policy: GradingPolicy) => void;
}

/**
 * The drop-lowest / downweight switches, as a controlled field group.
 *
 * Works on a bare `GradingPolicy` rather than a whole breakdown, so the same
 * component drives the draft in "Add breakdown" and the draft in the advanced
 * options dialog. It holds no rules of its own — everything comes from
 * `gradePolicies`, which the calculator reads too.
 */
export function AdvancedOptions({ policy, onChange }: AdvancedOptionsProps) {
  const activeOption = getActiveAdvancedOption(policy);

  // Turning a marks policy on clears the other; turning it off falls back to
  // 'none'. Spread over the existing policy so full credit survives the switch.
  const toggleOption = (option: AdvancedOption) => (enabled: boolean) =>
    onChange({ ...policy, ...advancedOptionUpdate(enabled ? option : 'none') });

  const setField = (field: keyof GradingPolicy, value: number | null) =>
    onChange({ ...policy, [field]: value });

  const toggleFullCredit = (enabled: boolean) =>
    setField('fullCreditGrade', enabled ? DEFAULT_FULL_CREDIT_GRADE : null);

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
          <Label className="text-sm font-medium flex items-center gap-1.5">
            Drop Lowest
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  Exclude the N lowest-scoring sub-breakdowns, ranked by percentage, before
                  totalling marks. Their full marks leave the total too. At least one is
                  always kept.
                </p>
              </TooltipContent>
            </Tooltip>
          </Label>
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
          <Label className="text-sm font-medium flex items-center gap-1.5">
            Downweight
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  Shrink the N lowest-scoring sub-breakdowns by a percentage — both their
                  marks and their full marks. A 100% downweight is equivalent to dropping.
                </p>
              </TooltipContent>
            </Tooltip>
          </Label>
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
            checked={policy.fullCreditGrade !== null}
            onCheckedChange={toggleFullCredit}
            aria-label="Full credit grade"
          />
          <Label className="text-sm font-medium flex items-center gap-1.5">
            Full Credit
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  Reaching this percentage earns 100% for the breakdown, and lower scores
                  scale up proportionally. With 60% for full credit, 59/100 becomes
                  59 / 60 = 98.33%. Combines with the options above.
                </p>
              </TooltipContent>
            </Tooltip>
          </Label>
        </div>
        {policy.fullCreditGrade !== null && (
          <div className="flex items-center gap-2 pt-3 animate-fade-in">
            <NumberInput
              min={0}
              max={100}
              value={policy.fullCreditGrade}
              onChange={e =>
                setField('fullCreditGrade', clampPercent(parseFloat(e.target.value) || 0))
              }
              className="w-16 h-8 text-center"
              aria-label="Full credit percentage"
            />
            <Label className="text-sm text-muted-foreground">% earns full credit</Label>
          </div>
        )}
      </div>
    </div>
  );
}
