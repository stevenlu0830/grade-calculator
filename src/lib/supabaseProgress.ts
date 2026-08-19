import { SupabaseClient } from '@supabase/supabase-js';
import { GradeData } from '@/types/grades';
import { SCHEMA_VERSION, migrate } from '@/lib/courseStorage';
import { USER_PROGRESS_TABLE, requireSupabase } from '@/lib/supabase';

/**
 * Save Progress and Reload Progress, backed by the `user_progress` table.
 *
 * The whole tree goes into one row as a single JSON document, for the same
 * reasons `supabaseCourseStorage` does it: the app saves and loads everything at
 * once, and row-level security on one row is a far smaller thing to get right
 * than a policy per table. It also makes a save **atomic** — the snapshot is
 * replaced whole or not at all, so there is no half-written state for a reload
 * to find, and no orphaned course to resurrect.
 *
 * This is a different table from `user_data`, which the store autosaves to after
 * every keystroke. Writing the snapshot there instead would leave Reload
 * Progress handing back exactly what is already on screen.
 */

/** One row of `user_progress`, as the table stores it. */
export interface UserProgressRow {
  user_id: string;
  version: number;
  data: unknown;
}

/** The row to write for a user. Pure — the effectful wrapper does the upsert. */
export function buildProgressRow(
  userId: string,
  { courses, semesters }: GradeData
): UserProgressRow {
  return {
    user_id: userId,
    version: SCHEMA_VERSION,
    // The same envelope `user_data` and `localStorage` hold, so all three share
    // `migrate` and a snapshot taken by an older build still opens.
    data: { version: SCHEMA_VERSION, courses, semesters },
  };
}

export interface ProgressSnapshot extends GradeData {
  /** When Save Progress last ran, or `null` if the row didn't say. */
  savedAt: Date | null;
}

/** What a read hands back: `data` plus the column the toast reports. */
export type ProgressSnapshotRow = Pick<UserProgressRow, 'data'> & { saved_at?: string | null };

/**
 * A snapshot read back from the table, or `null` when the account has never
 * pressed Save.
 *
 * That `null` is not the same as an empty snapshot, and the caller relies on the
 * difference: "you haven't saved anything yet" and "the copy you saved has no
 * courses in it" are different pieces of news, and only the first means there is
 * nothing to restore.
 *
 * Pure, and forgiving in the same way `migrate` is — an unreadable row reads as
 * an empty snapshot rather than throwing.
 */
export function parseProgressRow(row: ProgressSnapshotRow | null | undefined): ProgressSnapshot | null {
  if (!row || row.data === null || row.data === undefined) return null;

  const savedAt = row.saved_at ? new Date(row.saved_at) : null;
  return {
    ...migrate(row.data),
    // An unparseable timestamp is worth dropping, not worth failing the reload
    // over — the courses are the point, the date is a courtesy.
    savedAt: savedAt !== null && !Number.isNaN(savedAt.getTime()) ? savedAt : null,
  };
}

export interface ProgressSnapshotStorage {
  /** The saved snapshot, or `null` if this account has never saved one. */
  load(): Promise<ProgressSnapshot | null>;
  save(data: GradeData): Promise<void>;
}

/**
 * The signed-in user's snapshot.
 *
 * Failures throw rather than being logged, as in `supabaseCourseStorage`: both
 * buttons report their outcome to the student, and a silent failure would look
 * exactly like a save that worked.
 *
 * Not debounced — pressing Save Progress is a deliberate act, once, not a burst
 * of keystrokes to coalesce.
 */
export function supabaseProgressStorage(
  userId: string,
  client: SupabaseClient = requireSupabase()
): ProgressSnapshotStorage {
  return {
    async load(): Promise<ProgressSnapshot | null> {
      const { data, error } = await client
        .from(USER_PROGRESS_TABLE)
        .select('data, saved_at')
        .eq('user_id', userId)
        // An account that has never saved has no row, which is not an error.
        // `maybeSingle` returns null for that, where `single` would raise
        // PGRST116.
        .maybeSingle();

      if (error) throw error;
      return parseProgressRow(data as ProgressSnapshotRow | null);
    },

    async save(gradeData: GradeData): Promise<void> {
      // Upsert on the primary key: the first save inserts, every later one
      // replaces. Saving is deliberately a full overwrite — deleting a course
      // and saving must leave the snapshot without it, or a reload would bring
      // it back.
      const { error } = await client
        .from(USER_PROGRESS_TABLE)
        .upsert(buildProgressRow(userId, gradeData), { onConflict: 'user_id' });

      if (error) throw error;
    },
  };
}
