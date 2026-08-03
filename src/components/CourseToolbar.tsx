import { Course } from '@/types/grades';
import { exportToCSV } from '@/lib/csvExport';
import { exportToPDF } from '@/lib/pdfExport';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface CourseToolbarProps {
  courses: Course[];
  onImportClick: () => void;
  onAddCourse: () => void;
}

/** Header actions: import, export, and adding a course. */
export function CourseToolbar({ courses, onImportClick, onAddCourse }: CourseToolbarProps) {
  const exportWith = (exporter: (courses: Course[]) => void, label: string) => () => {
    if (courses.length === 0) {
      toast.error('No courses to export');
      return;
    }
    exporter(courses);
    toast.success(`Exported to ${label}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onImportClick}>
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
          <DropdownMenuItem onClick={exportWith(exportToCSV, 'CSV')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportWith(exportToPDF, 'PDF')}>
            <FileText className="h-4 w-4 mr-2" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={onAddCourse}>
        <Plus className="h-4 w-4 mr-2" />
        New Course
      </Button>
    </div>
  );
}
