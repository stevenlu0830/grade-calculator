import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';

/**
 * A tiny local API for reading and writing `progresses/<owner>/*.json` on disk.
 *
 * A browser page cannot touch the filesystem by itself — that's a sandbox rule,
 * not a missing library. But the dev server is a Node process sitting right
 * there, so the page asks it to do the file I/O. That makes Save/Reload fully
 * automatic: no folder picker, no download prompt.
 *
 *   GET  /api/progress  -> { directory, files: [{ name, contents }] }
 *   PUT  /api/progress  <- { files: [{ name, contents }] }
 *                       -> { directory, written, removed }
 *
 * Both carry the signed-in account's id in `X-Progress-Owner`, and every request
 * is confined to that account's own subfolder. Saving is a mirror — it deletes
 * files whose course is gone — so a single shared folder would mean the second
 * student to press Save wiped the first one's, and either of them could reload
 * the other's courses straight into their account.
 *
 * Only available while a Vite server is running. A statically built copy has no
 * Node process, so the client falls back to a download / file picker there.
 */

export const PROGRESS_API_ROUTE = '/api/progress';

/**
 * Carries the account id. A header rather than the URL so the id stays out of
 * request logs, and so `GET` — which has no body — can send it the same way
 * `PUT` does.
 */
export const PROGRESS_OWNER_HEADER = 'x-progress-owner';

export interface ProgressFilePayload {
  name: string;
  contents: string;
}

interface PluginOptions {
  /** Folder name, resolved against the Vite project root. */
  directory?: string;
}

/**
 * Rejects anything that could escape the progress folder.
 *
 * Filenames arrive from the browser, so path traversal is a real concern: a
 * name like `../../.bashrc` would otherwise let a page overwrite arbitrary
 * files. Unicode is allowed through — course names aren't always English — so
 * the check targets separators and dot-segments rather than an allow-list.
 */
export function isSafeProgressFileName(name: string): boolean {
  if (!name.toLowerCase().endsWith('.json')) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return false;
  if (name.startsWith('.')) return false;
  return path.basename(name) === name;
}

/** Resolves inside `directory`, or `null` if the name isn't safe. */
export function resolveProgressPath(directory: string, name: string): string | null {
  if (!isSafeProgressFileName(name)) return null;
  const resolved = path.resolve(directory, name);
  // Belt and braces: even a name that passed the checks must land in `directory`.
  return path.dirname(resolved) === path.resolve(directory) ? resolved : null;
}

/**
 * Rejects anything that couldn't be an account id.
 *
 * This value names a folder and arrives from the browser, so it gets the same
 * suspicion filenames get. Supabase ids are UUIDs; the check is deliberately a
 * little wider than that so a different auth provider doesn't silently break,
 * but narrow enough that no separator, dot-segment or shell character survives.
 */
export function isSafeOwnerId(owner: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(owner);
}

/** The owner's own folder under `base`, or `null` if the id isn't safe. */
export function resolveOwnerDirectory(base: string, owner: string): string | null {
  if (!isSafeOwnerId(owner)) return null;
  const resolved = path.resolve(base, owner);
  // As with filenames: the pattern above should make this impossible, so this
  // is the check that has to hold if the pattern is ever loosened.
  return path.dirname(resolved) === path.resolve(base) ? resolved : null;
}

const readBody = (req: Connect.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const sendJson = (res: { setHeader(k: string, v: string): void; end(b: string): void; statusCode: number }, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

export async function listProgressFiles(directory: string): Promise<ProgressFilePayload[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return []; // No folder yet — nothing saved, not an error.
  }

  const names = entries.filter(isSafeProgressFileName).sort((a, b) => a.localeCompare(b));

  const files: ProgressFilePayload[] = [];
  for (const name of names) {
    const filePath = resolveProgressPath(directory, name);
    if (!filePath) continue;
    files.push({ name, contents: await fs.readFile(filePath, 'utf8') });
  }
  return files;
}

/**
 * Makes `directory` match `incoming` exactly.
 *
 * This is an overwrite, not an append: any `.json` whose course no longer exists
 * is deleted, so saving with no courses leaves an empty folder. Reload reads
 * every file present, so anything left behind would come back as a course.
 */
export async function writeProgressFiles(directory: string, incoming: ProgressFilePayload[]) {
  await fs.mkdir(directory, { recursive: true });

  const written: string[] = [];
  for (const file of incoming) {
    const filePath = resolveProgressPath(directory, file.name);
    if (!filePath) continue; // Silently skip anything unsafe rather than failing the save.
    await fs.writeFile(filePath, file.contents, 'utf8');
    written.push(file.name);
  }

  // Files for deleted courses must go, or the next reload resurrects them.
  // Only `.json` directly in this folder is ever touched.
  const keep = new Set(written.map(name => name.toLowerCase()));
  const removed: string[] = [];
  for (const name of await fs.readdir(directory)) {
    if (!isSafeProgressFileName(name) || keep.has(name.toLowerCase())) continue;
    const filePath = resolveProgressPath(directory, name);
    if (!filePath) continue;
    await fs.unlink(filePath);
    removed.push(name);
  }

  return { written, removed };
}

/** The account id this request is for, or `''` if it didn't send a usable one. */
function ownerOf(req: Connect.IncomingMessage): string {
  const header = req.headers[PROGRESS_OWNER_HEADER];
  return Array.isArray(header) ? header[0] ?? '' : header ?? '';
}

function createHandler(baseDirectory: string, baseLabel: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    try {
      if (req.method !== 'GET' && req.method !== 'PUT') {
        next();
        return;
      }

      const owner = ownerOf(req);
      const directory = resolveOwnerDirectory(baseDirectory, owner);
      if (directory === null) {
        // Refusing beats guessing a folder: falling back to a shared one is how
        // two accounts end up overwriting each other in the first place.
        sendJson(res, 400, { error: `Missing or invalid ${PROGRESS_OWNER_HEADER} header.` });
        return;
      }

      // Shown in the app's toast, so the student can find the folder on disk.
      const directoryLabel = `${baseLabel}/${owner}`;

      if (req.method === 'GET') {
        sendJson(res, 200, { directory: directoryLabel, files: await listProgressFiles(directory) });
        return;
      }

      const body = JSON.parse((await readBody(req)) || '{}') as { files?: ProgressFilePayload[] };
      const result = await writeProgressFiles(directory, body.files ?? []);
      sendJson(res, 200, { directory: directoryLabel, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 500, { error: message });
    }
  };
}

export function progressFilesPlugin(options: PluginOptions = {}): Plugin {
  const directoryName = options.directory ?? 'progresses';

  const attach = (server: ViteDevServer | PreviewServer) => {
    const root = 'config' in server ? server.config.root : process.cwd();
    const directory = path.resolve(root, directoryName);
    server.middlewares.use(PROGRESS_API_ROUTE, createHandler(directory, directoryName));
  };

  return {
    name: 'grade-calculator-progress-files',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
