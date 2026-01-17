import { Course, Component as ComponentType } from '@/types/grades';
import { ComponentCard } from './ComponentCard';
import { GradeDisplay } from './GradeDisplay';
import { calculateCourseGrade, getTotalWeight } from '@/lib/gradeCalculations';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertTriangle, GraduationCap } from 'lucide-react';

interface CourseSectionProps {
  course: Course;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onAddComponent: () => void;
  onDeleteComponent: (componentId: string) => void;
  onUpdateComponent: (componentId: string, updates: Partial<ComponentType>) => void;
  onAddSubComponent: (componentId: string) => void;
  onDeleteSubComponent: (componentId: string, subComponentId: string) => void;
  onUpdateSubComponent: (
    componentId: string,
    subComponentId: string,
    updates: Partial<{ name: string; grade: number | null }>
  ) => void;
}

export function CourseSection({
  course,
  onUpdateName,
  onDelete,
  onAddComponent,
  onDeleteComponent,
  onUpdateComponent,
  onAddSubComponent,
  onDeleteSubComponent,
  onUpdateSubComponent,
}: CourseSectionProps) {
  const totalWeight = getTotalWeight(course.components);
  const weightsAreValid = totalWeight === 100;
  const courseGrade = weightsAreValid ? calculateCourseGrade(course.components) : null;
  const showWeightWarning = course.components.length > 0 && !weightsAreValid;

  return (
    <Card className="border-border shadow-md overflow-hidden animate-fade-in">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <Input
              value={course.name}
              onChange={e => onUpdateName(e.target.value)}
              className="flex-1 h-10 text-lg font-semibold border-transparent hover:border-border focus:border-border bg-transparent"
              placeholder="Course name"
            />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Final Grade
              </div>
              {weightsAreValid ? (
                <GradeDisplay grade={courseGrade} size="lg" showLetterGrade />
              ) : (
                <span className="text-2xl text-muted-foreground">—</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {showWeightWarning && (
          <Alert variant="destructive" className="bg-warning/10 border-warning">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm text-foreground">
              Component weights total {totalWeight.toFixed(1)}%. They should sum to 100%.
            </AlertDescription>
          </Alert>
        )}

        {course.components.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="mb-4">No components yet. Add one to get started.</p>
            <Button onClick={onAddComponent}>
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {course.components.map(component => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  onUpdate={updates => onUpdateComponent(component.id, updates)}
                  onDelete={() => onDeleteComponent(component.id)}
                  onAddSubComponent={() => onAddSubComponent(component.id)}
                  onUpdateSubComponent={(subId, updates) =>
                    onUpdateSubComponent(component.id, subId, updates)
                  }
                  onDeleteSubComponent={subId =>
                    onDeleteSubComponent(component.id, subId)
                  }
                />
              ))}
            </div>

            <Button
              variant="outline"
              onClick={onAddComponent}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
