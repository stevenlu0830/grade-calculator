import { SubComponent } from '@/types/grades';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface SubComponentRowProps {
  subComponent: SubComponent;
  canDelete: boolean;
  onUpdate: (updates: Partial<SubComponent>) => void;
  onDelete: () => void;
}

export function SubComponentRow({
  subComponent,
  canDelete,
  onUpdate,
  onDelete,
}: SubComponentRowProps) {
  const handleGradeChange = (value: string) => {
    if (value === '') {
      onUpdate({ grade: null });
      return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdate({ grade: numValue });
    }
  };

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-secondary/50 animate-fade-in">
      <Input
        value={subComponent.name}
        onChange={e => onUpdate({ name: e.target.value })}
        className="flex-1 h-8 text-sm bg-card border-border"
        placeholder="Assignment name"
      />
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={100}
          value={subComponent.grade ?? ''}
          onChange={e => handleGradeChange(e.target.value)}
          className="w-20 h-8 text-sm text-center font-mono bg-card border-border"
          placeholder="—"
        />
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={!canDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
