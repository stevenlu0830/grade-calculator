import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GradeData } from '@/types/grades';
import { SCHEMA_VERSION } from '@/lib/courseStorage';
import { USER_DATA_TABLE, USER_PROGRESS_TABLE, requireSupabase } from '@/lib/supabase';
import { supabaseCourseStorage } from '@/lib/supabaseCourseStorage';
import { supabaseProgressStorage } from '@/lib/supabaseProgress';

/**
 * The thin effectful halves of the two Supabase backends.
 *
 * Their pure builders and parsers are asserted next door, in
 * `supabaseCourseStorage.test.ts` and `supabaseProgress.test.ts`. What is left
 * here is the wiring — which table, filtered on whose row, upserted on which
 * key — and the one behaviour both wrappers exist to guarantee: a failed read
 * throws rather than reading back as an empty account, because the store saves
 * over whatever a load hands it.
 */

/** What the fake was asked for, so a test can assert the query and not just the answer. */
interface Recorded {
  table: string;
  select?: string;
  eq?: [string, unknown];
  upsert?: [unknown, unknown];
}

interface FakeResult {
  data?: unknown;
  error?: unknown;
}

/** A stand-in for the two chained calls these wrappers make, and nothing else. */
function fakeClient(result: FakeResult = { data: null }) {
  const calls: Recorded[] = [];

  const client = {
    from(table: string) {
      const recorded: Recorded = { table };
      calls.push(recorded);

      const chain = {
        select(columns: string) {
          recorded.select = columns;
          return chain;
        },
        eq(column: string, value: unknown) {
          recorded.eq = [column, value];
          return chain;
        },
        async maybeSingle() {
          return { data: result.data ?? null, error: result.error ?? null };
        },
        async upsert(row: unknown, options: unknown) {
          recorded.upsert = [row, options];
          return { data: null, error: result.error ?? null };
        },
      };

      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const sample: GradeData = {
  courses: [{ id: 'c1', name: 'CPSC 121', semester: '2026 Winter Term 1', breakdowns: [] }],
  semesters: ['2026 Winter Term 1'],
};

describe('requireSupabase', () => {
  it('names the missing configuration instead of handing back null', () => {
    // The test environment has no VITE_SUPABASE_* set, which is exactly the
    // situation this exists for: a forgotten .env.local should read as setup
    // instructions, not as `undefined is not a function` three frames later.
    expect(() => requireSupabase()).toThrow(/VITE_SUPABASE_URL/);
  });
});

describe('supabaseCourseStorage', () => {
  let fake: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    fake = fakeClient();
  });

  it('reads only the signed-in user’s row of user_data', async () => {
    await supabaseCourseStorage('user-1', fake.client).load();

    expect(fake.calls[0]).toMatchObject({
      table: USER_DATA_TABLE,
      select: 'data',
      eq: ['user_id', 'user-1'],
    });
  });

  it('reads a brand new account, which has no row yet, as empty', async () => {
    expect(await supabaseCourseStorage('user-1', fake.client).load()).toEqual({
      courses: [],
      semesters: [],
    });
  });

  it('reads back what a save wrote', async () => {
    const written = fakeClient({
      data: { data: { version: SCHEMA_VERSION, ...sample } },
    });

    expect(await supabaseCourseStorage('user-1', written.client).load()).toEqual(sample);
  });

  it('upserts on the user id, so the first save inserts and the rest update', async () => {
    await supabaseCourseStorage('user-1', fake.client).save(sample);

    expect(fake.calls[0].table).toBe(USER_DATA_TABLE);
    expect(fake.calls[0].upsert?.[0]).toMatchObject({ user_id: 'user-1', version: SCHEMA_VERSION });
    expect(fake.calls[0].upsert?.[1]).toEqual({ onConflict: 'user_id' });
  });

  it('throws a failed read rather than reporting an empty account', async () => {
    // The whole reason this backend throws where `localCourseStorage` logs: the
    // store autosaves what a load returned, so a swallowed read error would
    // write an empty tree over a term's worth of grades.
    const broken = fakeClient({ error: new Error('network down') });

    await expect(supabaseCourseStorage('user-1', broken.client).load()).rejects.toThrow(
      'network down'
    );
  });

  it('throws a failed save, so the UI can say the changes aren’t saving', async () => {
    const broken = fakeClient({ error: new Error('row level security') });

    await expect(supabaseCourseStorage('user-1', broken.client).save(sample)).rejects.toThrow(
      'row level security'
    );
  });
});

describe('supabaseProgressStorage', () => {
  it('reads the snapshot table, not the autosave table', async () => {
    // Reading the autosave would make Reload Progress hand back exactly what is
    // already on screen.
    const fake = fakeClient();

    await supabaseProgressStorage('user-1', fake.client).load();

    expect(fake.calls[0]).toMatchObject({
      table: USER_PROGRESS_TABLE,
      select: 'data, saved_at',
      eq: ['user_id', 'user-1'],
    });
  });

  it('reports an account that has never saved as null', async () => {
    expect(await supabaseProgressStorage('user-1', fakeClient().client).load()).toBeNull();
  });

  it('reads back a snapshot with the time it was taken', async () => {
    const fake = fakeClient({
      data: {
        data: { version: SCHEMA_VERSION, ...sample },
        saved_at: '2026-08-19T14:03:00.000Z',
      },
    });

    const snapshot = await supabaseProgressStorage('user-1', fake.client).load();

    expect(snapshot?.courses).toEqual(sample.courses);
    expect(snapshot?.savedAt?.toISOString()).toBe('2026-08-19T14:03:00.000Z');
  });

  it('upserts on the user id, replacing the previous snapshot whole', async () => {
    const fake = fakeClient();

    await supabaseProgressStorage('user-1', fake.client).save(sample);

    expect(fake.calls[0].table).toBe(USER_PROGRESS_TABLE);
    expect(fake.calls[0].upsert?.[1]).toEqual({ onConflict: 'user_id' });
  });

  it('throws either way, because both buttons report their outcome', async () => {
    const broken = fakeClient({ error: new Error('offline') });

    await expect(supabaseProgressStorage('u', broken.client).load()).rejects.toThrow('offline');
    await expect(supabaseProgressStorage('u', broken.client).save(sample)).rejects.toThrow(
      'offline'
    );
  });
});
