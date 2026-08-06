import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';

/**
 * A tiny local API for reading and writing `progresses/*.json` on disk.
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
 * Only available while a Vite server is running. A statically built copy has no
 * Node process, so the client falls back to a download / file picker there.
 */

export const PROGRESS_API_ROUTE = '/api/progress';

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

function createHandler(directory: string, directoryLabel: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    try {
      if (req.method === 'GET') {
        sendJson(res, 200, { directory: directoryLabel, files: await listProgressFiles(directory) });
        return;
      }

      if (req.method === 'PUT') {
        const body = JSON.parse((await readBody(req)) || '{}') as { files?: ProgressFilePayload[] };
        const result = await writeProgressFiles(directory, body.files ?? []);
        sendJson(res, 200, { directory: directoryLabel, ...result });
        return;
      }

      next();
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
