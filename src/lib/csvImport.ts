import { Component, Course } from '@/types/grades';
import { clampGrade } from '@/lib/gradeCalculations';
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

type ColumnMap = Record<
  | 'courseName'
  | 'componentName'
  | 'weight'
  | 'dropLowest'
  | 'downweightCount'
  | 'downweightPercent'
  | 'subName'
  | 'grade',
  number
>;

/**
 * Locates each column by header name, falling back to its canonical position.
 *
 * Lets a file survive reordered or added columns, which spreadsheet round-trips
 * routinely introduce.
 */
function resolveColumns(header: string[]): ColumnMap {
  const trimmed = header.map(h => (h ?? '').trim());
  const indexOf = (name: (typeof CSV_HEADERS)[number]): number => {
    const found = trimmed.indexOf(name);
    return found >= 0 ? found : CSV_HEADERS.indexOf(name);
  };

  return {
    courseName: indexOf('Course Name'),
    componentName: indexOf('Component Name'),
    weight: indexOf('Component Weight (%)'),
    dropLowest: indexOf('Drop Lowest'),
    downweightCount: indexOf('Downweight Count'),
    downweightPercent: indexOf('Downweight %'),
    subName: indexOf('Sub-component Name'),
    grade: indexOf('Grade'),
  };
}

const toFloat = (value: string): number | null => (value ? parseFloat(value) : null);
const toInt = (value: string): number | null => (value ? parseInt(value) : null);

function createComponent(courseId: string, name: string, row: string[], col: ColumnMap): Component {
  return {
    id: createId(),
    courseId,
    name,
    weight: toFloat(row[col.weight]),
    dropLowestCount: toInt(row[col.dropLowest]),
    downweightLowestCount: toInt(row[col.downweightCount]),
    downweightPercent: toFloat(row[col.downweightPercent]),
    subComponents: [],
  };
}

/** Every component needs at least one row for the UI to render an input. */
function ensureSubComponent(component: Component): void {
  if (component.subComponents.length === 0) {
    component.subComponents.push({
      id: createId(),
      componentId: component.id,
      name: '',
      grade: null,
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
  let currentComponent: Component | null = null;

  for (const row of dataLines) {
    while (row.length < width) row.push('');

    const cell = (index: number): string => row[index] ?? '';

    // Blank parent cells mean "same as the row above" — see `firstRowOnly`.
    const courseName = cell(col.courseName) || currentCourseName;
    currentCourseName = courseName;

    if (!coursesByName.has(courseName)) {
      coursesByName.set(courseName, { id: createId(), name: courseName, components: [] });
    }
    const course = coursesByName.get(courseName)!;

    const componentName = cell(col.componentName);
    if (componentName) {
      currentComponent = createComponent(course.id, componentName, row, col);
      course.components.push(currentComponent);
    }

    const subName = cell(col.subName);
    if (currentComponent && subName) {
      const grade = toFloat(cell(col.grade));
      currentComponent.subComponents.push({
        id: createId(),
        componentId: currentComponent.id,
        name: subName,
        grade: grade === null ? null : clampGrade(grade),
      });
    }
  }

  const courses = Array.from(coursesByName.values());
  courses.forEach(course => course.components.forEach(ensureSubComponent));
  return courses;
}
