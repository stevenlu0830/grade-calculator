import { Breakdown, Course } from '@/types/grades';
import { downloadBlob } from '@/lib/download';
import { firstRowOnly, timestampedFilename } from '@/lib/exportFormat';

/**
 * Serialises courses to the CSV format `csvImport.ts` reads back.
 *
 * `buildCoursesCsv` is pure so the format can be asserted directly in tests;
 * `exportToCSV` is the thin effectful wrapper that hands it to the browser.
 */

export const CSV_HEADERS = [
  'Course Name',
  'Breakdown Name',
  'Breakdown Weight (%)',
  'Drop Lowest',
  'Downweight Count',
  'Downweight %',
  'Sub-breakdown Name',
  'Marks Achieved',
  'Full Marks',
] as const;

const EMPTY_ROW_TAIL = ['', '', ''];

const optional = (value: number | null): string => value?.toString() ?? '';

/** Wraps a cell in quotes only when it contains a delimiter, doubling any quotes. */
function escapeCell(cell: string): string {
  const escaped = cell.replace(/"/g, '""');
  const needsQuoting = cell.includes(',') || cell.includes('"') || cell.includes('\n');
  return needsQuoting ? `"${escaped}"` : escaped;
}

/** The six parent columns, blanked on every row but the group's first. */
function breakdownCells(course: Course, breakdown: Breakdown, rowIndex: number): string[] {
  return [
    firstRowOnly(rowIndex, course.name),
    firstRowOnly(rowIndex, breakdown.name),
    firstRowOnly(rowIndex, optional(breakdown.weight)),
    firstRowOnly(rowIndex, optional(breakdown.dropLowestCount)),
    firstRowOnly(rowIndex, optional(breakdown.downweightLowestCount)),
    firstRowOnly(rowIndex, optional(breakdown.downweightPercent)),
  ];
}

function courseRows(course: Course): string[][] {
  if (course.breakdowns.length === 0) {
    return [[course.name, '', '', '', '', '', '', '', '']];
  }

  return course.breakdowns.flatMap(breakdown => {
    if (breakdown.subBreakdowns.length === 0) {
      return [[...breakdownCells(course, breakdown, 0), ...EMPTY_ROW_TAIL]];
    }

    return breakdown.subBreakdowns.map((subBreakdown, index) => [
      ...breakdownCells(course, breakdown, index),
      subBreakdown.name,
      optional(subBreakdown.achievedMarks),
      optional(subBreakdown.fullMarks),
    ]);
  });
}

/** The complete CSV document for `courses`, header row included. */
export function buildCoursesCsv(courses: Course[]): string {
  const rows = [[...CSV_HEADERS], ...courses.flatMap(courseRows)];
  return rows.map(row => row.map(escapeCell).join(',')).join('\n');
}

export function exportToCSV(courses: Course[]): void {
  const blob = new Blob([buildCoursesCsv(courses)], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, timestampedFilename('grades_export', 'csv'));
}
