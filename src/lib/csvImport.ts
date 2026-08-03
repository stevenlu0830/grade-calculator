import { Breakdown, Course } from '@/types/grades';
import { DEFAULT_FULL_MARKS, clampAchievedMarks } from '@/lib/gradeCalculations';
import { presetFor } from '@/lib/breakdownPresets';
import { createId } from '@/lib/id';
import { CSV_HEADERS } from '@/lib/csvExport';

/**
 * Reads the CSV format produced by `csvExport.ts` back into courses.
 *
 * Split into three steps — tokenise, resolve columns, build the tree — so each
 * can be reasoned about on its own.
 *
 * Known limitation: rows are split on newlines before quotes are interpreted,
 * so a quoted field containing a line break will be torn across rows. Fine for
 * self-exported files; a spreadsheet with multi-line notes will not round-trip.
 */

/** Splits one CSV line into cells, honouring quoted sections and `""` escapes. */
function parseLine(line: string): string[] {
  const cells: string[] = [];
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
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

type ColumnKey =
  | 'courseName'
  | 'breakdownName'
  | 'weight'
  | 'dropLowest'
  | 'downweightCount'
  | 'downweightPercent'
  | 'subName'
  | 'achievedMarks'
  | 'fullMarks';

type ColumnMap = Record<ColumnKey, number>;

/**
 * Header names for each column, current first.
 *
 * The trailing entries are the pre-"breakdown" spelling, kept so CSVs exported
 * by older builds still import. `Full Marks` has no legacy equivalent — files
 * without it fall back to 100, which is what those grades already meant.
 */
const COLUMN_ALIASES: Record<ColumnKey, readonly string[]> = {
  courseName: ['Course Name'],
  breakdownName: ['Breakdown Name', 'Component Name'],
  weight: ['Breakdown Weight (%)', 'Component Weight (%)'],
  dropLowest: ['Drop Lowest'],
  downweightCount: ['Downweight Count'],
  downweightPercent: ['Downweight %'],
  subName: ['Sub-breakdown Name', 'Sub-component Name'],
  achievedMarks: ['Marks Achieved', 'Grade'],
  fullMarks: ['Full Marks'],
};

const COLUMN_KEYS = Object.keys(COLUMN_ALIASES) as ColumnKey[];

/**
 * Locates each column by header name, falling back to its canonical position.
 *
 * Lets a file survive reordered or added columns, which spreadsheet round-trips
 * routinely introduce. A missing column resolves to -1 and reads as empty.
 */
function resolveColumns(header: string[]): ColumnMap {
  const trimmed = header.map(h => (h ?? '').trim());

  const resolve = (key: ColumnKey): number => {
    for (const alias of COLUMN_ALIASES[key]) {
      const found = trimmed.indexOf(alias);
      if (found >= 0) return found;
    }
    return CSV_HEADERS.indexOf(COLUMN_ALIASES[key][0] as (typeof CSV_HEADERS)[number]);
  };

  return Object.fromEntries(COLUMN_KEYS.map(key => [key, resolve(key)])) as ColumnMap;
}

const toFloat = (value: string): number | null => (value ? parseFloat(value) : null);
const toInt = (value: string): number | null => (value ? parseInt(value) : null);

function createBreakdown(
  courseId: string,
  name: string,
  cell: (index: number) => string,
  col: ColumnMap
): Breakdown {
  return {
    id: createId(),
    courseId,
    name,
    weight: toFloat(cell(col.weight)),
    dropLowestCount: toInt(cell(col.dropLowest)),
    downweightLowestCount: toInt(cell(col.downweightCount)),
    downweightPercent: toFloat(cell(col.downweightPercent)),
    subBreakdownLabel: presetFor(name).singular,
    subBreakdowns: [],
  };
}

/** Every breakdown needs at least one row for the UI to render an input. */
function ensureSubBreakdown(breakdown: Breakdown): void {
  if (breakdown.subBreakdowns.length === 0) {
    breakdown.subBreakdowns.push({
      id: createId(),
      breakdownId: breakdown.id,
      name: `${breakdown.subBreakdownLabel} 1`,
      achievedMarks: null,
      fullMarks: DEFAULT_FULL_MARKS,
    });
  }
}

export function parseCSV(csvText: string): Course[] {
  const lines = csvText.split('\n').map(parseLine);
  const col = resolveColumns(lines[0] ?? []);
  const width = Math.max(lines[0]?.length ?? 0, CSV_HEADERS.length);

  const dataLines = lines.slice(1).filter(row => row.some(cell => cell !== ''));

  const coursesByName = new Map<string, Course>();
  let currentCourseName = '';
  let currentBreakdown: Breakdown | null = null;

  for (const row of dataLines) {
    while (row.length < width) row.push('');

    const cell = (index: number): string => (index >= 0 ? row[index] ?? '' : '');

    // Blank parent cells mean "same as the row above" — see `firstRowOnly`.
    const courseName = cell(col.courseName) || currentCourseName;
    currentCourseName = courseName;

    if (!coursesByName.has(courseName)) {
      coursesByName.set(courseName, { id: createId(), name: courseName, breakdowns: [] });
    }
    const course = coursesByName.get(courseName)!;

    const breakdownName = cell(col.breakdownName);
    if (breakdownName) {
      currentBreakdown = createBreakdown(course.id, breakdownName, cell, col);
      course.breakdowns.push(currentBreakdown);
    }

    const subName = cell(col.subName);
    if (currentBreakdown && subName) {
      const fullMarks = toFloat(cell(col.fullMarks)) ?? DEFAULT_FULL_MARKS;
      const achieved = toFloat(cell(col.achievedMarks));

      currentBreakdown.subBreakdowns.push({
        id: createId(),
        breakdownId: currentBreakdown.id,
        name: subName,
        achievedMarks: achieved === null ? null : clampAchievedMarks(achieved, fullMarks),
        fullMarks: Math.max(0, fullMarks),
      });
    }
  }

  const courses = Array.from(coursesByName.values());
  courses.forEach(course => course.breakdowns.forEach(ensureSubBreakdown));
  return courses;
}
