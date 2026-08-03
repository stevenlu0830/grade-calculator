import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Component, Course } from '@/types/grades';
import {
  areWeightsValid,
  calculateComponentGrade,
  calculateCourseGrade,
  calculateWeightedValue,
  getTotalWeight,
} from '@/lib/gradeCalculations';
import { formatWeight, getLetterGrade } from '@/lib/gradeFormatting';
import { firstRowOnly, timestampedFilename } from '@/lib/exportFormat';

/** Renders a printable grade report. */

/**
 * jspdf-autotable augments the document at runtime but types its own document
 * as `any`, so the position it leaves the cursor at has to be described here.
 */
interface AutoTableDocument extends jsPDF {
  lastAutoTable?: { finalY?: number };
}

const MARGIN_LEFT = 14;
const PAGE_BREAK_Y = 250;
const TOP_OF_PAGE_Y = 20;
const HEADER_FILL: [number, number, number] = [99, 102, 241];

const TABLE_HEADERS = [
  'Component',
  'Weight',
  'Advanced Options',
  'Sub-component',
  'Grade',
  'Component Grade',
  'Weighted Grade',
];

const percent = (value: number | null, decimals = 0): string =>
  value !== null ? `${value.toFixed(decimals)}%` : '-';

function describeAdvancedOptions(component: Component): string {
  if (component.dropLowestCount && component.dropLowestCount > 0) {
    return `Drop lowest ${component.dropLowestCount}`;
  }
  if (
    component.downweightLowestCount &&
    component.downweightLowestCount > 0 &&
    component.downweightPercent &&
    component.downweightPercent > 0
  ) {
    return `Downweight lowest ${component.downweightLowestCount} by ${component.downweightPercent}%`;
  }
  return '-';
}

/**
 * One row per sub-component, with the parent's columns printed only on the
 * first row of each group. Pure, so the report's contents can be asserted.
 */
export function buildReportRows(course: Course): string[][] {
  return course.components.flatMap(component => {
    const componentGrade = calculateComponentGrade(component);
    const weightedGrade = calculateWeightedValue(component);
    const advancedOptions = describeAdvancedOptions(component);

    return component.subComponents.map((sub, index) => [
      firstRowOnly(index, component.name),
      firstRowOnly(index, component.weight !== null ? `${component.weight}%` : '-'),
      firstRowOnly(index, advancedOptions),
      sub.name,
      sub.grade !== null ? `${sub.grade}%` : '-',
      firstRowOnly(index, percent(componentGrade, 1)),
      firstRowOnly(index, percent(weightedGrade, 1)),
    ]);
  });
}

/** Draws one course and returns the y position the next course should start at. */
function renderCourse(doc: jsPDF, course: Course, startY: number): number {
  let y = startY;

  if (y > PAGE_BREAK_Y) {
    doc.addPage();
    y = TOP_OF_PAGE_Y;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(course.name || 'Unnamed Course', MARGIN_LEFT, y);

  // A final grade is only meaningful once the weights add up.
  const courseGrade = areWeightsValid(course.components)
    ? calculateCourseGrade(course.components)
    : null;

  if (courseGrade !== null) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Final Grade: ${courseGrade.toFixed(1)}% (${getLetterGrade(courseGrade)})`,
      MARGIN_LEFT,
      y + 7
    );
  } else {
    const totalWeight = getTotalWeight(course.components);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Weights total ${formatWeight(totalWeight)}% - must be 100% for final grade`,
      MARGIN_LEFT,
      y + 7
    );
  }

  y += 15;

  if (course.components.length === 0) return y;

  autoTable(doc, {
    startY: y,
    head: [TABLE_HEADERS],
    body: buildReportRows(course),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    margin: { left: MARGIN_LEFT },
  });

  const finalY = (doc as AutoTableDocument).lastAutoTable?.finalY;
  return finalY !== undefined ? finalY + 10 : y;
}

export function exportToPDF(courses: Course[]): void {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('UBC Grade Calculator Report', MARGIN_LEFT, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, MARGIN_LEFT, 30);

  let y = 40;
  courses.forEach((course, index) => {
    y = renderCourse(doc, course, index > 0 ? y + 10 : y);
  });

  doc.save(timestampedFilename('grades_report', 'pdf'));
}
