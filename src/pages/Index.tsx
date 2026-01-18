import { useRef } from 'react';
import { useGradeStore } from '@/hooks/useGradeStore';
import { CourseSection } from '@/components/CourseSection';
import { Button } from '@/components/ui/button';
import { Plus, GraduationCap, Download, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF, parseCSV } from '@/lib/exportImport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleExportCSV = () => {
    if (courses.length === 0) {
      toast.error('No courses to export');
      return;
    }
    exportToCSV(courses);
    toast.success('Exported to CSV');
  };

  const handleExportPDF = () => {
    if (courses.length === 0) {
      toast.error('No courses to export');
      return;
    }
    exportToPDF(courses);
    toast.success('Exported to PDF');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const parsedCourses = parseCSV(csvText);
        
        if (parsedCourses.length === 0) {
          toast.error('No valid data found in CSV');
          return;
        }
        
        importCourses(parsedCourses);
        toast.success(`Imported ${parsedCourses.length} course(s)`);
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* Header */}
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleImportClick}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={addCourse}>
                <Plus className="h-4 w-4 mr-2" />
                New Course
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-8">
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-muted mb-6">
              <GraduationCap className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              No courses yet
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Add your first course to start calculating your grades in real-time.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleImportClick}>
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
          <div className="space-y-6">
            {courses.map(course => (
              <CourseSection
                key={course.id}
                course={course}
                onUpdateName={name => updateCourseName(course.id, name)}
                onDelete={() => deleteCourse(course.id)}
                onAddComponent={() => addComponent(course.id)}
                onDeleteComponent={componentId =>
                  deleteComponent(course.id, componentId)
                }
                onUpdateComponent={(componentId, updates) =>
                  updateComponent(course.id, componentId, updates)
                }
                onAddSubComponent={componentId =>
                  addSubComponent(course.id, componentId)
                }
                onDeleteSubComponent={(componentId, subComponentId) =>
                  deleteSubComponent(course.id, componentId, subComponentId)
                }
                onUpdateSubComponent={(componentId, subComponentId, updates) =>
                  updateSubComponent(course.id, componentId, subComponentId, updates)
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
