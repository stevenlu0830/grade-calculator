import { Breakdown, SubBreakdown } from '@/types/grades';
import { SubBreakdownRow } from './SubBreakdownRow';
import { AdvancedOptions } from './AdvancedOptions';
import { GradeDisplay } from './GradeDisplay';
import { calculateBreakdownGrade, calculateWeightedValue } from '@/lib/gradeCalculations';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const grade = calculateBreakdownGrade(breakdown);
  const weightedValue = calculateWeightedValue(breakdown);

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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <Input
                value={breakdown.name}
                onChange={e => onUpdate({ name: e.target.value })}
                className="flex-1 h-9 font-medium border-transparent hover:border-border focus:border-border bg-transparent"
                placeholder="Breakdown name"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <NumberInput
                  min={0}
                  max={100}
                  value={breakdown.weight ?? ''}
                  onChange={handleWeightChange}
                  className="w-16 h-9 text-center font-mono"
                  aria-label="Breakdown weight"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <GradeDisplay grade={grade} size="md" />
              <div className="flex items-center gap-1 min-w-[60px]">
                <span className="text-xs text-muted-foreground">Weighted:</span>
                <span className="text-sm font-mono font-medium">
                  {weightedValue !== null ? weightedValue.toFixed(1) : '—'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
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

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary"
                onClick={onAddSubBreakdown}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Sub-breakdown
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings2 className="h-4 w-4 mr-1.5" />
                {showAdvanced ? 'Hide Options' : 'Advanced'}
              </Button>
            </div>

            {showAdvanced && <AdvancedOptions breakdown={breakdown} onUpdate={onUpdate} />}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
