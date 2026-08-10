import { SupabaseClient } from '@supabase/supabase-js';
import { GradeData } from '@/types/grades';
import {
  CourseStorage,
  EMPTY_GRADE_DATA,
  SCHEMA_VERSION,
  migrate,
} from '@/lib/courseStorage';
import { USER_DATA_TABLE, requireSupabase } from '@/lib/supabase';

/**
 * One row of `user_data`, as the table stores it.
 *
 * `data` deliberately holds the same `{ version, courses, semesters }` envelope
 * `localStorage` holds, so the two backends share `migrate` and a row saved by
 * an older build still opens.
 */
export interface UserDataRow {
  user_id: string;
  version: number;
  data: unknown;
}

/** The row to write for a user. Pure — the effectful wrapper does the upsert. */
export function buildUserDataRow(userId: string, { courses, semesters }: GradeData): UserDataRow {
  return {
    user_id: userId,
    version: SCHEMA_VERSION,
    data: { version: SCHEMA_VERSION, courses, semesters },
  };
}

/**
 * A row read back from the table, or `null` for an account with nothing saved.
 *
 * Pure, and forgiving in the same way `migrate` is: anything unrecognisable
 * reads as empty rather than throwing, because a student with one corrupt row
 * should still get a usable app.
 */
export function parseUserDataRow(row: Pick<UserDataRow, 'data'> | null | undefined): GradeData {
  if (!row || row.data === null || row.data === undefined) return EMPTY_GRADE_DATA;
  return migrate(row.data);
}

/**
 * Grade data stored in the signed-in user's row of `user_data`.
 *
 * The whole tree is written as one JSON document rather than spread across
 * relational tables. The app already loads and saves everything at once, and
 * row-level security on a single row is a much smaller thing to get right than
 * a policy on each of four tables.
 *
 * Unlike `localCourseStorage`, failures here are thrown rather than logged: the
 * network is not a rare edge case, and the store needs to know a read failed so
 * it can refuse to overwrite the account with an empty tree.
 */
export function supabaseCourseStorage(
  userId: string,
  client: SupabaseClient = requireSupabase()
): CourseStorage {
  return {
    async load(): Promise<GradeData> {
      const { data, error } = await client
        .from(USER_DATA_TABLE)
        .select('data')
        .eq('user_id', userId)
        // A brand new account has no row yet, which is not an error. `maybeSingle`
        // returns null for that, where `single` would raise PGRST116.
        .maybeSingle();

      if (error) throw error;
      return parseUserDataRow(data as Pick<UserDataRow, 'data'> | null);
    },

    async save(gradeData: GradeData): Promise<void> {
      // Upsert on the primary key: the first save of a new account inserts, and
      // every save after it updates. No "have I created my row yet?" bookkeeping.
      const { error } = await client
        .from(USER_DATA_TABLE)
        .upsert(buildUserDataRow(userId, gradeData), { onConflict: 'user_id' });

      if (error) throw error;
    },
  };
}
