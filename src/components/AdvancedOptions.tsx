import { AdvancedOption, Component } from '@/types/grades';
import {
  DEFAULT_DOWNWEIGHT_COUNT,
  DEFAULT_DOWNWEIGHT_PERCENT,
  DEFAULT_DROP_LOWEST_COUNT,
  advancedOptionUpdate,
  clampPercent,
  getActiveAdvancedOption,
} from '@/lib/gradePolicies';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface AdvancedOptionsProps {
  component: Component;
  onUpdate: (updates: Partial<Component>) => void;
}

export function AdvancedOptions({ component, onUpdate }: AdvancedOptionsProps) {
  const activeOption = getActiveAdvancedOption(component);

  // Turning a policy on clears the other; turning it off falls back to 'none'.
  const toggleOption = (option: AdvancedOption) => (enabled: boolean) =>
    onUpdate(advancedOptionUpdate(enabled ? option : 'none'));

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Advanced Options
      </div>

      {/* Drop Lowest */}
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2 min-w-[160px]">
          <Switch
            checked={activeOption === 'dropLowest'}
            onCheckedChange={toggleOption('dropLowest')}
            disabled={activeOption === 'downweight'}
          />
          <Label className="text-sm font-medium flex items-center gap-1.5">
            Drop Lowest
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  Exclude the N lowest sub-component grades before calculating
                  the average. At least one grade will always be kept.
                </p>
              </TooltipContent>
            </Tooltip>
          </Label>
        </div>
        {activeOption === 'dropLowest' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Label className="text-sm text-muted-foreground">Drop</Label>
            <Input
              type="number"
              min={1}
              value={component.dropLowestCount ?? DEFAULT_DROP_LOWEST_COUNT}
              onChange={e =>
                onUpdate({
                  dropLowestCount: parseInt(e.target.value) || DEFAULT_DROP_LOWEST_COUNT,
                })
              }
              className="w-16 h-8 text-center"
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
          />
          <Label className="text-sm font-medium flex items-center gap-1.5">
            Downweight
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  Reduce the weight of the N lowest grades by a percentage. A
                  100% downweight is equivalent to dropping.
                </p>
              </TooltipContent>
            </Tooltip>
          </Label>
        </div>
        {activeOption === 'downweight' && (
          <div className="flex items-center gap-2 flex-wrap animate-fade-in">
            <Label className="text-sm text-muted-foreground">Reduce</Label>
            <Input
              type="number"
              min={1}
              value={component.downweightLowestCount ?? DEFAULT_DOWNWEIGHT_COUNT}
              onChange={e =>
                onUpdate({
                  downweightLowestCount: parseInt(e.target.value) || DEFAULT_DOWNWEIGHT_COUNT,
                })
              }
              className="w-16 h-8 text-center"
            />
            <Label className="text-sm text-muted-foreground">lowest by</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={component.downweightPercent ?? DEFAULT_DOWNWEIGHT_PERCENT}
              onChange={e =>
                onUpdate({ downweightPercent: clampPercent(parseInt(e.target.value) || 0) })
              }
              className="w-16 h-8 text-center"
            />
            <Label className="text-sm text-muted-foreground">%</Label>
          </div>
        )}
      </div>
    </div>
  );
}
