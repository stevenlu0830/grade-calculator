import { Course } from '@/types/grades';
import { SCHEMA_VERSION, migrate } from '@/lib/courseStorage';
import { downloadBlob } from '@/lib/download';
import { timestampedFilename } from '@/lib/exportFormat';

/**
 * Saving and reloading progress as one JSON file per course.
 *
 * "CPSC 330" is written to `progresses/CPSC_330.json`. Every file uses the same
 * `{ version, courses }` envelope as `localStorage`, holding a single course, and
 * loading runs through the same `migrate` — so a file written by an older build
 * still opens, and the persisted shape is defined in exactly one place.
 *
 * The actual disk access happens in the dev server (`vite-plugin-progress-files`),
 * because a browser page cannot read or write a folder on its own. The page just
 * asks the server, which makes Save/Reload fully automatic — no picker, no
 * download prompt. Where no server is present (a static build), the functions
 * here fall back to a download and a manual file picker.
 */

export const PROGRESS_API_ROUTE = '/api/progress';
export const PROGRESS_DIRECTORY_NAME = 'progresses';

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

/** Pretty-printed so a student can read or hand-edit the file. */
export function buildProgressJson(courses: Course[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, courses }, null, 2);
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
export function parseProgressJson(text: string): Course[] {
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

/** One file per course, ready to hand to the server. */
export function buildProgressFiles(courses: Course[]): { name: string; contents: string }[] {
  const taken = new Set<string>();
  return courses.map(course => ({
    name: courseFileName(course.name, taken),
    contents: buildProgressJson([course]),
  }));
}

export interface LoadResult {
  courses: Course[];
  /** Files that weren't readable progress; reported rather than failing the load. */
  skipped: string[];
}

/** Parses several files, tolerating individual bad ones. */
export function parseProgressFiles(files: { name: string; contents: string }[]): LoadResult {
  const courses: Course[] = [];
  const skipped: string[] = [];

  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      courses.push(...parseProgressJson(file.contents));
    } catch {
      skipped.push(file.name);
    }
  }

  return { courses, skipped };
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
 * Writes one file per course into `progresses/`, with no prompt.
 *
 * The server prunes files whose course was deleted; reload reads *every* JSON in
 * the folder, so leaving them would bring deleted courses back.
 */
export async function saveProgressToServer(courses: Course[]): Promise<SaveResult> {
  const response = await requestProgressApi({
    method: 'PUT',
    body: JSON.stringify({ files: buildProgressFiles(courses) }),
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
  const payload = (await response.json()) as { files?: { name: string; contents: string }[] };
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
 * combined file is the workable shape.
 */
export function saveProgressAsSingleFile(courses: Course[]): void {
  const blob = new Blob([buildProgressJson(courses)], { type: 'application/json' });
  downloadBlob(blob, timestampedFilename('grade_progress', 'json'));
}
