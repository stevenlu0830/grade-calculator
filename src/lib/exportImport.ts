import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Course, Component, SubComponent } from '@/types/grades';
import { calculateComponentGrade, calculateCourseGrade, getTotalWeight, getLetterGrade } from './gradeCalculations';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const exportToCSV = (courses: Course[]): void => {
  const rows: string[][] = [];
  
  // Header row
  rows.push(['Course Name', 'Component Name', 'Component Weight (%)', 'Drop Lowest', 'Downweight Count', 'Downweight %', 'Sub-component Name', 'Grade']);
  
  courses.forEach(course => {
    if (course.components.length === 0) {
      rows.push([course.name, '', '', '', '', '', '', '']);
    } else {
      course.components.forEach(component => {
        if (component.subComponents.length === 0) {
          rows.push([
            course.name,
            component.name,
            component.weight.toString(),
            component.dropLowestCount?.toString() || '',
            component.downweightLowestCount?.toString() || '',
            component.downweightPercent?.toString() || '',
            '',
            ''
          ]);
        } else {
          component.subComponents.forEach((subComponent, index) => {
            rows.push([
              index === 0 ? course.name : '',
              index === 0 ? component.name : '',
              index === 0 ? component.weight.toString() : '',
              index === 0 ? (component.dropLowestCount?.toString() || '') : '',
              index === 0 ? (component.downweightLowestCount?.toString() || '') : '',
              index === 0 ? (component.downweightPercent?.toString() || '') : '',
              subComponent.name,
              subComponent.grade !== null ? subComponent.grade.toString() : ''
            ]);
          });
        }
      });
    }
  });
  
  const csvContent = rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma or quote
      const escaped = cell.replace(/"/g, '""');
      return cell.includes(',') || cell.includes('"') || cell.includes('\n') 
        ? `"${escaped}"` 
        : escaped;
    }).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `grades_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToPDF = (courses: Course[]): void => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Grade Report', 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  
  let yPosition = 40;
  
  courses.forEach((course, courseIndex) => {
    if (courseIndex > 0) {
      yPosition += 10;
    }
    
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    const totalWeight = getTotalWeight(course.components);
    const courseGrade = totalWeight === 100 ? calculateCourseGrade(course.components) : null;
    const letterGrade = courseGrade !== null ? getLetterGrade(courseGrade) : 'N/A';
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(course.name || 'Unnamed Course', 14, yPosition);
    
    if (courseGrade !== null) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Final Grade: ${courseGrade.toFixed(1)}% (${letterGrade})`, 14, yPosition + 7);
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(`Weights total ${totalWeight.toFixed(1)}% - must be 100% for final grade`, 14, yPosition + 7);
    }
    
    yPosition += 15;
    
    if (course.components.length > 0) {
      const tableData: (string | number)[][] = [];
      
      course.components.forEach(component => {
        const componentGrade = calculateComponentGrade(component);
        
        component.subComponents.forEach((sub, index) => {
          tableData.push([
            index === 0 ? component.name : '',
            index === 0 ? `${component.weight}%` : '',
            sub.name,
            sub.grade !== null ? `${sub.grade}%` : '-',
            index === 0 ? (componentGrade !== null ? `${componentGrade.toFixed(1)}%` : '-') : ''
          ]);
        });
      });
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Component', 'Weight', 'Sub-component', 'Grade', 'Component Grade']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: 14 },
        didDrawPage: (data) => {
          yPosition = data.cursor?.y || yPosition;
        }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }
  });
  
  doc.save(`grades_report_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const parseCSV = (csvText: string): Course[] => {
  const lines = csvText.split('\n').map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
  
  // Skip header row
  const dataLines = lines.slice(1).filter(row => row.some(cell => cell !== ''));
  
  const coursesMap = new Map<string, Course>();
  let currentCourseName = '';
  let currentComponentName = '';
  let currentComponent: Component | null = null;
  
  dataLines.forEach(row => {
    const [courseName, componentName, weightStr, dropLowest, downweightCount, downweightPercent, subName, gradeStr] = row;
    
    // Get or create course
    const effectiveCourseName = courseName || currentCourseName;
    currentCourseName = effectiveCourseName;
    
    if (!coursesMap.has(effectiveCourseName)) {
      coursesMap.set(effectiveCourseName, {
        id: generateId(),
        name: effectiveCourseName,
        components: []
      });
    }
    
    const course = coursesMap.get(effectiveCourseName)!;
    
    // Handle component
    const effectiveComponentName = componentName || currentComponentName;
    
    if (componentName) {
      currentComponentName = componentName;
      const componentId = generateId();
      currentComponent = {
        id: componentId,
        courseId: course.id,
        name: componentName,
        weight: parseFloat(weightStr) || 0,
        dropLowestCount: dropLowest ? parseInt(dropLowest) : null,
        downweightLowestCount: downweightCount ? parseInt(downweightCount) : null,
        downweightPercent: downweightPercent ? parseFloat(downweightPercent) : null,
        subComponents: []
      };
      course.components.push(currentComponent);
    }
    
    // Add sub-component if present
    if (currentComponent && subName) {
      currentComponent.subComponents.push({
        id: generateId(),
        componentId: currentComponent.id,
        name: subName,
        grade: gradeStr ? Math.min(100, Math.max(0, parseFloat(gradeStr))) : null
      });
    }
  });
  
  // Ensure each component has at least one sub-component
  coursesMap.forEach(course => {
    course.components.forEach(component => {
      if (component.subComponents.length === 0) {
        component.subComponents.push({
          id: generateId(),
          componentId: component.id,
          name: '',
          grade: null
        });
      }
    });
  });
  
  return Array.from(coursesMap.values());
};
