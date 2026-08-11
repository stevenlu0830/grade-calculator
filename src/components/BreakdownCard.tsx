import { Breakdown, SubBreakdown } from '@/types/grades';
import { SubBreakdownRow } from './SubBreakdownRow';
import { AdvancedOptionsDialog } from './AdvancedOptionsDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { GradeDisplay } from './GradeDisplay';
import { describePolicy } from '@/lib/gradePolicies';
import { calculateBreakdownGrade, calculateWeightedValue } from '@/lib/gradeCalculations';
import { formatGrade } from '@/lib/gradeFormatting';
import { plural } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NumberInput } from '@/components/NumberInput';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, Trash2, Settings2 } from 'lucide-react';
import { useState } from 'react';

interface BreakdownCardProps {
  breakdown: Breakdown;
  onUpdate: (updates: Partial<Breakdown>) => void;
  onDelete: () => void;
  onAddSubBreakdown: () => void;
  onUpdateSubBreakdown: (subBreakdownId: string, updates: Partial<SubBreakdown>) => void;
  onDeleteSubBreakdown: (subBreakdownId: string) => void;
}

export function BreakdownCard({
  breakdown,
  onUpdate,
  onDelete,
  onAddSubBreakdown,
  onUpdateSubBreakdown,
  onDeleteSubBreakdown,
}: BreakdownCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const grade = calculateBreakdownGrade(breakdown);
  const weightedValue = calculateWeightedValue(breakdown);
  const activePolicy = describePolicy(breakdown);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onUpdate({ weight: null });
    } else {
      const parsed = parseFloat(value);
      onUpdate({ weight: isNaN(parsed) ? null : parsed });
    }
  };

  return (
    <Card className="border-border shadow-sm animate-scale-in">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-2 pb-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <Input
                value={breakdown.name}
                onChange={e => onUpdate({ name: e.target.value })}
                className="flex-1 min-w-0 h-7 px-1.5 text-xs font-medium border-transparent hover:border-border focus:border-border bg-transparent"
                placeholder="Breakdown name"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1">
                <NumberInput
                  min={0}
                  max={100}
                  value={breakdown.weight ?? ''}
                  onChange={handleWeightChange}
                  className="w-12 h-7 px-1 text-xs text-center font-mono"
                  aria-label="Breakdown weight"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
                {/* Shown in the header because it changes what that weight
                    means — the advanced options are a click away and collapsed. */}
                {breakdown.isBonus && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                    Bonus
                  </Badge>
                )}
              </div>
              <GradeDisplay grade={grade} size="sm" />
              {/* Abbreviated because the full word cost more room than the
                  number it labels; the tooltip gives it back. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    W:
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatGrade(weightedValue)}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Weighted: what this breakdown contributes to the course
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="Delete breakdown"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-2 pt-0">
            <div className="space-y-1">
              {breakdown.subBreakdowns.map(sb => (
                <SubBreakdownRow
                  key={sb.id}
                  subBreakdown={sb}
                  canDelete={breakdown.subBreakdowns.length > 1}
                  onUpdate={updates => onUpdateSubBreakdown(sb.id, updates)}
                  onDelete={() => onDeleteSubBreakdown(sb.id)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 mt-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-primary hover:text-primary"
                onClick={onAddSubBreakdown}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Sub-breakdown
              </Button>
              <div className="flex items-center gap-1 min-w-0">
                {/* Surfaced here because the options themselves now live in a
                    modal — otherwise an active policy would be invisible. */}
                {activePolicy && (
                  <span className="truncate text-[10px] text-muted-foreground">{activePolicy}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[11px] text-muted-foreground"
                  onClick={() => setAdvancedOpen(true)}
                >
                  <Settings2 className="h-3 w-3 mr-1" />
                  Advanced
                </Button>
              </div>
            </div>

            <AdvancedOptionsDialog
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
              policy={breakdown}
              onApply={onUpdate}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Outside the collapsible: collapsing the card must not unmount an open
          confirmation out from under the student. */}
      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${breakdown.name.trim() || 'this breakdown'}?`}
        description={`Deleting a breakdown also deletes everything under it — ${plural(
          breakdown.subBreakdowns.length,
          'sub-breakdown'
        )} and every mark entered on them. This cannot be undone.`}
        confirmLabel="Delete breakdown"
        onConfirm={onDelete}
      />
    </Card>
  );
}
