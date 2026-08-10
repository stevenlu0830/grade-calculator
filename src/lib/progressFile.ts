import { Course, GradeData } from '@/types/grades';
import { SCHEMA_VERSION, migrate } from '@/lib/courseStorage';
import { downloadBlob } from '@/lib/download';
import { timestampedFilename } from '@/lib/exportFormat';

/**
 * Saving and reloading progress as one JSON file per course, plus a manifest.
 *
 * "CPSC 330" is written to `progresses/CPSC_330.json`. Every file uses the same
 * `{ version, courses }` envelope as `localStorage`, holding a single course, and
 * loading runs through the same `migrate` — so a file written by an older build
 * still opens, and the persisted shape is defined in exactly one place.
 *
 * Two things can't live in a per-course file, so they go in `_manifest.json`:
 * a semester with no courses in it, and the order the courses were in. Reading
 * the folder back would otherwise give whatever order the filenames sort in,
 * which is not the order the student arranged them in.
 *
 * The actual disk access happens in the dev server (`vite-plugin-progress-files`),
 * because a browser page cannot read or write a folder on its own. The page just
 * asks the server, which makes Save/Reload fully automatic — no picker, no
 * download prompt. Where no server is present (a static build), the functions
 * here fall back to a download and a manual file picker.
 */

export const PROGRESS_API_ROUTE = '/api/progress';
export const PROGRESS_DIRECTORY_NAME = 'progresses';

/**
 * Holds what no single course file can: the semester list and the course order.
 *
 * Named with a leading underscore so it reads as "not a course" in a file
 * listing, and it's still a plain `.json` the dev server will write.
 */
export const PROGRESS_MANIFEST_FILE = '_manifest.json';

export const isManifestFile = (name: string) =>
  name.toLowerCase() === PROGRESS_MANIFEST_FILE;

/** What the fallback file picker should accept. */
export const PROGRESS_FILE_ACCEPT = '.json,application/json';

// --- File naming ------------------------------------------------------------

/** Characters Windows and macOS reject in filenames. */
const UNSAFE_CHARACTERS = /[\\/:*?"<>|]/g;

/**
 * The filename for a course: spaces become underscores, so "Databases in Data
 * Science" is written to `Databases_in_Data_Science.json`.
 *
 * `taken` is matched case-insensitively and mutated as names are handed out,
 * because macOS and Windows treat `CPSC_330.json` and `cpsc_330.json` as the
 * same file — two courses differing only in case would otherwise overwrite
 * each other.
 */
export function courseFileName(courseName: string, taken: Set<string> = new Set()): string {
  const base =
    courseName
      .replace(UNSAFE_CHARACTERS, '')
      .trim()
      .replace(/\s+/g, '_')
      // Leading dots would make a hidden file, and the server rejects those —
      // a course named ".." would otherwise be dropped from the save without a
      // word. Stripping them here keeps every course writable.
      .replace(/^\.+/, '') || 'Untitled_Course';

  let candidate = `${base}.json`;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}_${suffix++}.json`;
  }

  taken.add(candidate.toLowerCase());
  return candidate;
}

// --- File contents ----------------------------------------------------------

/**
 * Pretty-printed so a student can read or hand-edit the file.
 *
 * `semesters` is written only when given: a per-course file has nothing to say
 * about semesters beyond the one its course names, and the manifest carries the
 * list. The single-file fallback does pass it, since there's no manifest there.
 */
export function buildProgressJson(courses: Course[], semesters?: string[]): string {
  return JSON.stringify(
    semesters ? { version: SCHEMA_VERSION, courses, semesters } : { version: SCHEMA_VERSION, courses },
    null,
    2
  );
}

interface ProgressManifest {
  version: number;
  semesters: string[];
  /** Course ids, in the order they were saved. */
  courseOrder: string[];
}

/**
 * The manifest for `data`.
 *
 * Ordering is keyed on course id rather than filename, so renaming a course —
 * and with it its file — doesn't shuffle the list on the next reload.
 */
export function buildManifestJson(data: GradeData): string {
  const manifest: ProgressManifest = {
    version: SCHEMA_VERSION,
    semesters: data.semesters,
    courseOrder: data.courses.map(course => course.id),
  };
  return JSON.stringify(manifest, null, 2);
}

/** Reads a manifest, or `null` if it isn't one. */
function parseManifest(text: string): ProgressManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object') return null;

  const { semesters, courseOrder } = raw as Partial<ProgressManifest>;
  if (!Array.isArray(semesters) && !Array.isArray(courseOrder)) return null;

  return {
    version: (raw as ProgressManifest).version ?? SCHEMA_VERSION,
    semesters: Array.isArray(semesters) ? semesters.filter(s => typeof s === 'string') : [],
    courseOrder: Array.isArray(courseOrder) ? courseOrder.filter(id => typeof id === 'string') : [],
  };
}

/**
 * Courses back in their saved order.
 *
 * Anything the manifest doesn't mention — a file added by hand, a course saved
 * by an older build — keeps its incoming (filename) order at the end, rather
 * than being dropped or jumping to the front.
 */
export function orderCourses(courses: Course[], courseOrder: string[]): Course[] {
  const rank = new Map(courseOrder.map((id, index) => [id, index]));
  // Unlisted courses share one rank past the end, so a stable sort keeps them
  // in the order they arrived rather than reshuffling them among themselves.
  const rankOf = (course: Course) => rank.get(course.id) ?? courseOrder.length;
  return [...courses].sort((a, b) => rankOf(a) - rankOf(b));
}

/**
 * A cheap shape check before handing anything to `migrate`.
 *
 * Without it, an unrelated JSON file would "succeed" and silently wipe every
 * course, since `migrate` is lenient by design.
 */
function looksLikeProgress(raw: unknown): boolean {
  if (Array.isArray(raw)) {
    return raw.every(entry => entry !== null && typeof entry === 'object');
  }
  if (raw === null || typeof raw !== 'object') return false;
  return Array.isArray((raw as { courses?: unknown }).courses);
}

/** Throws with a message worth showing the user if the file isn't usable. */
export function parseProgressJson(text: string): GradeData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!looksLikeProgress(raw)) {
    throw new Error("That doesn't look like a saved progress file.");
  }

  return migrate(raw);
}

export interface ProgressFile {
  name: string;
  contents: string;
}

/**
 * The manifest plus one file per course, ready to hand to the server.
 *
 * The manifest is written even when there are no courses at all — that empty
 * folder still has to remember the semesters.
 */
export function buildProgressFiles(data: GradeData): ProgressFile[] {
  // Reserved up front so a course called "manifest" can't claim the name.
  const taken = new Set<string>([PROGRESS_MANIFEST_FILE]);

  return [
    { name: PROGRESS_MANIFEST_FILE, contents: buildManifestJson(data) },
    ...data.courses.map(course => ({
      name: courseFileName(course.name, taken),
      contents: buildProgressJson([course]),
    })),
  ];
}

export interface LoadResult extends GradeData {
  /** Files that weren't readable progress; reported rather than failing the load. */
  skipped: string[];
}

/**
 * Parses several files, tolerating individual bad ones.
 *
 * Files are read in filename order and then put back into the manifest's order,
 * so a save followed by a reload gives the same list of courses in the same
 * arrangement — regardless of how an editor or the filesystem sorted them.
 */
export function parseProgressFiles(files: ProgressFile[]): LoadResult {
  const courses: Course[] = [];
  const semesters = new Set<string>();
  const skipped: string[] = [];
  let courseOrder: string[] = [];

  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (isManifestFile(file.name)) {
      const manifest = parseManifest(file.contents);
      if (!manifest) {
        skipped.push(file.name);
        continue;
      }
      manifest.semesters.forEach(semester => semesters.add(semester));
      courseOrder = manifest.courseOrder;
      continue;
    }

    try {
      const data = parseProgressJson(file.contents);
      courses.push(...data.courses);
      data.semesters.forEach(semester => semesters.add(semester));
    } catch {
      skipped.push(file.name);
    }
  }

  return { courses: orderCourses(courses, courseOrder), semesters: [...semesters], skipped };
}

// --- Automatic save / load via the dev server -------------------------------

/** Thrown when no local server is answering, so callers can fall back. */
export class ProgressApiUnavailableError extends Error {
  constructor() {
    super('No local server is available to read or write files.');
    this.name = 'ProgressApiUnavailableError';
  }
}

export interface SaveResult {
  directory: string;
  written: string[];
  /** Files for courses that no longer exist, deleted so a reload can't resurrect them. */
  removed: string[];
}

/**
 * Writes the manifest and one file per course into `progresses/`, with no prompt.
 *
 * The server prunes files whose course was deleted; reload reads *every* JSON in
 * the folder, so leaving them would bring deleted courses back.
 */
export async function saveProgressToServer(data: GradeData): Promise<SaveResult> {
  const response = await requestProgressApi({
    method: 'PUT',
    body: JSON.stringify({ files: buildProgressFiles(data) }),
    headers: { 'Content-Type': 'application/json' },
  });

  const result = (await response.json()) as SaveResult;
  return {
    directory: result.directory ?? PROGRESS_DIRECTORY_NAME,
    written: result.written ?? [],
    removed: result.removed ?? [],
  };
}

/** Reads every file in `progresses/` back into courses, with no prompt. */
export async function loadProgressFromServer(): Promise<LoadResult> {
  const response = await requestProgressApi({ method: 'GET' });
  const payload = (await response.json()) as { files?: ProgressFile[] };
  return parseProgressFiles(payload.files ?? []);
}

async function requestProgressApi(init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(PROGRESS_API_ROUTE, init);
  } catch {
    // No server listening at all — a static build, or the dev server stopped.
    throw new ProgressApiUnavailableError();
  }

  // A built copy served by something else answers the SPA fallback with HTML,
  // so a 200 alone isn't proof the API is really there.
  const isJson = response.headers.get('content-type')?.includes('application/json');
  if (!response.ok || !isJson) throw new ProgressApiUnavailableError();

  return response;
}

// --- Fallback for builds with no server -------------------------------------

/**
 * Everything in one download.
 *
 * Used only when the local API isn't reachable: a page with no server behind it
 * can't create folders, and multiple downloads get blocked as pop-ups, so one
 * combined file is the workable shape. It carries the semesters itself, and the
 * courses keep their order by virtue of being one array — so there's no manifest
 * to write alongside it.
 */
export function saveProgressAsSingleFile({ courses, semesters }: GradeData): void {
  const blob = new Blob([buildProgressJson(courses, semesters)], { type: 'application/json' });
  downloadBlob(blob, timestampedFilename('grade_progress', 'json'));
}
