import { Course } from '@/types/grades';
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
  'Component Name',
  'Component Weight (%)',
  'Drop Lowest',
  'Downweight Count',
  'Downweight %',
  'Sub-component Name',
  'Grade',
] as const;

const EMPTY_ROW_TAIL = ['', ''];

const optional = (value: number | null): string => value?.toString() ?? '';

/** Wraps a cell in quotes only when it contains a delimiter, doubling any quotes. */
function escapeCell(cell: string): string {
  const escaped = cell.replace(/"/g, '""');
  const needsQuoting = cell.includes(',') || cell.includes('"') || cell.includes('\n');
  return needsQuoting ? `"${escaped}"` : escaped;
}

/** The six parent columns, blanked on every row but the group's first. */
function componentCells(
  course: Course,
  component: Course['components'][number],
  rowIndex: number
): string[] {
  return [
    firstRowOnly(rowIndex, course.name),
    firstRowOnly(rowIndex, component.name),
    firstRowOnly(rowIndex, optional(component.weight)),
    firstRowOnly(rowIndex, optional(component.dropLowestCount)),
    firstRowOnly(rowIndex, optional(component.downweightLowestCount)),
    firstRowOnly(rowIndex, optional(component.downweightPercent)),
  ];
}

function courseRows(course: Course): string[][] {
  if (course.components.length === 0) {
    return [[course.name, '', '', '', '', '', '', '']];
  }

  return course.components.flatMap(component => {
    if (component.subComponents.length === 0) {
      return [[...componentCells(course, component, 0), ...EMPTY_ROW_TAIL]];
    }

    return component.subComponents.map((subComponent, index) => [
      ...componentCells(course, component, index),
      subComponent.name,
      subComponent.grade !== null ? subComponent.grade.toString() : '',
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
