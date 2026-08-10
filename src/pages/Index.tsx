import { useMemo, useState } from 'react';
import { useGradeStore } from '@/hooks/useGradeStore';
import { useProgressFile } from '@/hooks/useProgressFile';
import { CourseSection } from '@/components/CourseSection';
import { CourseToolbar } from '@/components/CourseToolbar';
import { NewCourseDialog } from '@/components/NewCourseDialog';
import { AddSemesterDialog } from '@/components/AddSemesterDialog';
import { SemesterPanel } from '@/components/SemesterPanel';
import { Button } from '@/components/ui/button';
import { DISPLAY_DECIMALS } from '@/lib/gradeFormatting';
import { PROGRESS_FILE_ACCEPT } from '@/lib/progressFile';
import { coursesIn, semesterLabel, visibleSemesters } from '@/lib/semesters';
import { GraduationCap, Plus } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [newSemesterOpen, setNewSemesterOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);

  const {
    courses,
    semesters: savedSemesters,
    addSemester,
    deleteSemester,
    addCourse,
    deleteCourse,
    updateCourseName,
    addBreakdown,
    deleteBreakdown,
    updateBreakdown,
    addSubBreakdown,
    deleteSubBreakdown,
    updateSubBreakdown,
    importData,
  } = useGradeStore();

  const { inputRef, saveProgress, reloadProgress, handleFileChange } = useProgressFile(
    courses,
    savedSemesters,
    importData
  );

  const semesters = useMemo(
    () => visibleSemesters(courses, savedSemesters),
    [courses, savedSemesters]
  );

  // Selecting the first available semester keeps the panel from looking inert
  // after a reload, when semesters arrive from the loaded courses.
  const activeSemester =
    selectedSemester !== null && semesters.includes(selectedSemester)
      ? selectedSemester
      : semesters[0] ?? null;

  const visibleCourses = useMemo(
    () => (activeSemester === null ? [] : coursesIn(courses, activeSemester)),
    [courses, activeSemester]
  );

  const handleAddSemester = (semester: string) => {
    addSemester(semester);
    setSelectedSemester(semester);
  };

  /** The panel has already confirmed by the time this runs. */
  const handleDeleteSemester = (semester: string) => {
    // Whatever was selected may have just gone; `activeSemester` falls back to
    // the first one left on its own.
    deleteSemester(semester);
    toast.success(`Deleted ${semesterLabel(semester)}`);
  };

  const openNewCourse = () => {
    // A course has to belong to a semester, so there must be one selected.
    if (activeSemester === null) {
      toast.error('Add a semester first', {
        description: 'Courses are grouped by semester.',
      });
      return;
    }
    setNewCourseOpen(true);
  };

  const handleAddCourse = (name: string) => {
    if (activeSemester === null) return;
    addCourse(name, activeSemester);
  };

  return (
    <div className="min-h-screen bg-background">
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept={PROGRESS_FILE_ACCEPT}
        multiple
        className="hidden"
      />

      <NewCourseDialog
        open={newCourseOpen}
        onOpenChange={setNewCourseOpen}
        onAdd={handleAddCourse}
        semester={activeSemester ?? undefined}
      />

      <AddSemesterDialog
        open={newSemesterOpen}
        onOpenChange={setNewSemesterOpen}
        onAdd={handleAddSemester}
      />

      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">UBC Grade Calculator</h1>
                <p className="text-sm text-muted-foreground"></p>
              </div>
            </div>
            <CourseToolbar
              onReloadClick={reloadProgress}
              onSaveClick={saveProgress}
              onAddCourse={openNewCourse}
            />
          </div>

          {/* Grades are computed at full precision and rounded only here, so a
              column of displayed figures may not visibly add up. */}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Numbers shown in this UI are rounded to {DISPLAY_DECIMALS} decimal places and may not
            sum up to 100%. Calculations use the full unrounded values.
          </p>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-105px)]">
        <SemesterPanel
          semesters={semesters}
          selected={activeSemester}
          courses={courses}
          onSelect={setSelectedSemester}
          onAddSemester={() => setNewSemesterOpen(true)}
          onDeleteSemester={handleDeleteSemester}
        />

        <main className="flex-1 min-w-0 px-4 py-8">
          {activeSemester === null ? (
            <EmptyState
              heading="No semesters yet"
              body="Add a semester on the left, then add courses to it."
            />
          ) : visibleCourses.length === 0 ? (
            <EmptyState
              heading={`No courses in ${semesterLabel(activeSemester)}`}
              body="Add your first course to start calculating your grades in real-time."
              action={
                <Button size="lg" onClick={openNewCourse}>
                  <Plus className="h-5 w-5 mr-2" />
                  Add Your First Course
                </Button>
              }
            />
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
              {visibleCourses.map(course => (
                <div key={course.id} className="flex-shrink-0 w-full max-w-2xl snap-start">
                  <CourseSection
                    course={course}
                    onUpdateName={name => updateCourseName(course.id, name)}
                    onDelete={() => deleteCourse(course.id)}
                    onAddBreakdown={breakdown => addBreakdown(course.id, breakdown)}
                    onDeleteBreakdown={breakdownId => deleteBreakdown(course.id, breakdownId)}
                    onUpdateBreakdown={(breakdownId, updates) =>
                      updateBreakdown(course.id, breakdownId, updates)
                    }
                    onAddSubBreakdown={breakdownId => addSubBreakdown(course.id, breakdownId)}
                    onDeleteSubBreakdown={(breakdownId, subBreakdownId) =>
                      deleteSubBreakdown(course.id, breakdownId, subBreakdownId)
                    }
                    onUpdateSubBreakdown={(breakdownId, subBreakdownId, updates) =>
                      updateSubBreakdown(course.id, breakdownId, subBreakdownId, updates)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

function EmptyState({
  heading,
  body,
  action,
}: {
  heading: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-2xl bg-muted mb-6">
        <GraduationCap className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">{heading}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">{body}</p>
      {action}
    </div>
  );
}

export default Index;
