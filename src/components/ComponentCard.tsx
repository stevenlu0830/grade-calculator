import { Component } from '@/types/grades';
import { SubComponentRow } from './SubComponentRow';
import { AdvancedOptions } from './AdvancedOptions';
import { GradeDisplay } from './GradeDisplay';
import { calculateComponentGrade, calculateWeightedValue } from '@/lib/gradeCalculations';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, Trash2, Settings2 } from 'lucide-react';
import { useState } from 'react';

interface ComponentCardProps {
  component: Component;
  onUpdate: (updates: Partial<Component>) => void;
  onDelete: () => void;
  onAddSubComponent: () => void;
  onUpdateSubComponent: (
    subComponentId: string,
    updates: Partial<{ name: string; grade: number | null }>
  ) => void;
  onDeleteSubComponent: (subComponentId: string) => void;
}

export function ComponentCard({
  component,
  onUpdate,
  onDelete,
  onAddSubComponent,
  onUpdateSubComponent,
  onDeleteSubComponent,
}: ComponentCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const componentGrade = calculateComponentGrade(component);
  const weightedValue = calculateWeightedValue(component);

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
                    className={`h-4 w-4 transition-transform ${
                      isOpen ? '' : '-rotate-90'
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <Input
                value={component.name}
                onChange={e => onUpdate({ name: e.target.value })}
                className="flex-1 h-9 font-medium border-transparent hover:border-border focus:border-border bg-transparent"
                placeholder="Component name"
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={component.weight ?? ''}
                  onChange={handleWeightChange}
                  className="w-16 h-9 text-center font-mono"
                  placeholder=""
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <GradeDisplay grade={componentGrade} size="md" />
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
              {component.subComponents.map(sc => (
                <SubComponentRow
                  key={sc.id}
                  subComponent={sc}
                  canDelete={component.subComponents.length > 1}
                  onUpdate={updates => onUpdateSubComponent(sc.id, updates)}
                  onDelete={() => onDeleteSubComponent(sc.id)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary"
                onClick={onAddSubComponent}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Sub-component
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

            {showAdvanced && (
              <AdvancedOptions component={component} onUpdate={onUpdate} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
