import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Breakdown, Course } from '@/types/grades';
import {
  areWeightsValid,
  calculateBreakdownGrade,
  calculateCourseGrade,
  calculateWeightedValue,
  getTotalWeight,
} from '@/lib/gradeCalculations';
import { formatGrade, formatWeight, getLetterGrade } from '@/lib/gradeFormatting';
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
  'Breakdown',
  'Weight',
  'Advanced Options',
  'Sub-breakdown',
  'Marks',
  'Breakdown Grade',
  'Weighted Grade',
];

const percent = (value: number | null): string =>
  value !== null ? `${formatGrade(value)}%` : '-';

const marks = (value: number | null): string => (value !== null ? value.toString() : '-');

function describeAdvancedOptions(breakdown: Breakdown): string {
  if (breakdown.dropLowestCount && breakdown.dropLowestCount > 0) {
    return `Drop lowest ${breakdown.dropLowestCount}`;
  }
  if (
    breakdown.downweightLowestCount &&
    breakdown.downweightLowestCount > 0 &&
    breakdown.downweightPercent &&
    breakdown.downweightPercent > 0
  ) {
    return `Downweight lowest ${breakdown.downweightLowestCount} by ${breakdown.downweightPercent}%`;
  }
  return '-';
}

/**
 * One row per sub-breakdown, with the parent's columns printed only on the
 * first row of each group. Pure, so the report's contents can be asserted.
 */
export function buildReportRows(course: Course): string[][] {
  return course.breakdowns.flatMap(breakdown => {
    const grade = calculateBreakdownGrade(breakdown);
    const weightedGrade = calculateWeightedValue(breakdown);
    const advancedOptions = describeAdvancedOptions(breakdown);

    return breakdown.subBreakdowns.map((sub, index) => [
      firstRowOnly(index, breakdown.name),
      firstRowOnly(index, breakdown.weight !== null ? `${breakdown.weight}%` : '-'),
      firstRowOnly(index, advancedOptions),
      sub.name,
      `${marks(sub.achievedMarks)} / ${marks(sub.fullMarks)}`,
      firstRowOnly(index, percent(grade)),
      firstRowOnly(index, percent(weightedGrade)),
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
  const courseGrade = areWeightsValid(course.breakdowns)
    ? calculateCourseGrade(course.breakdowns)
    : null;

  if (courseGrade !== null) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Final Grade: ${formatGrade(courseGrade)}% (${getLetterGrade(courseGrade)})`,
      MARGIN_LEFT,
      y + 7
    );
  } else {
    const totalWeight = getTotalWeight(course.breakdowns);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Weights total ${formatWeight(totalWeight)}% - must be 100% for final grade`,
      MARGIN_LEFT,
      y + 7
    );
  }

  y += 15;

  if (course.breakdowns.length === 0) return y;

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
