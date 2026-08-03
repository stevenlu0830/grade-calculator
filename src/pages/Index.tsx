import { useGradeStore } from '@/hooks/useGradeStore';
import { useCsvImport } from '@/hooks/useCsvImport';
import { CourseSection } from '@/components/CourseSection';
import { CourseToolbar } from '@/components/CourseToolbar';
import { Button } from '@/components/ui/button';
import { GraduationCap, Plus, Upload } from 'lucide-react';

const Index = () => {
  const {
    courses,
    addCourse,
    deleteCourse,
    updateCourseName,
    addComponent,
    deleteComponent,
    updateComponent,
    addSubComponent,
    deleteSubComponent,
    updateSubComponent,
    importCourses,
  } = useGradeStore();

  const { inputRef, openFilePicker, handleFileChange } = useCsvImport(importCourses);

  return (
    <div className="min-h-screen bg-background">
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">UBC Grade Calculator</h1>
                <p className="text-sm text-muted-foreground">Track your course grades</p>
              </div>
            </div>
            <CourseToolbar
              courses={courses}
              onImportClick={openFilePicker}
              onAddCourse={addCourse}
            />
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-8">
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-muted mb-6">
              <GraduationCap className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">No courses yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Add your first course to start calculating your grades in real-time.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={openFilePicker}>
                <Upload className="h-5 w-5 mr-2" />
                Import from CSV
              </Button>
              <Button size="lg" onClick={addCourse}>
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Course
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
            {courses.map(course => (
              <div key={course.id} className="flex-shrink-0 w-full max-w-2xl snap-start">
                <CourseSection
                  course={course}
                  onUpdateName={name => updateCourseName(course.id, name)}
                  onDelete={() => deleteCourse(course.id)}
                  onAddComponent={() => addComponent(course.id)}
                  onDeleteComponent={componentId => deleteComponent(course.id, componentId)}
                  onUpdateComponent={(componentId, updates) =>
                    updateComponent(course.id, componentId, updates)
                  }
                  onAddSubComponent={componentId => addSubComponent(course.id, componentId)}
                  onDeleteSubComponent={(componentId, subComponentId) =>
                    deleteSubComponent(course.id, componentId, subComponentId)
                  }
                  onUpdateSubComponent={(componentId, subComponentId, updates) =>
                    updateSubComponent(course.id, componentId, subComponentId, updates)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
