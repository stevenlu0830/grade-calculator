import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GradeData } from '@/types/grades';
import { CourseStorage, EMPTY_GRADE_DATA } from '@/lib/courseStorage';
import { debouncedStorage } from '@/lib/debouncedStorage';

const dataWith = (...names: string[]): GradeData => ({
  courses: names.map(name => ({ id: name, name, semester: '', breakdowns: [] })),
  semesters: [],
});

interface RecordingStorage extends CourseStorage {
  writes: GradeData[];
}

const recording = (): RecordingStorage => {
  const box: RecordingStorage = {
    writes: [],
    load: async () => EMPTY_GRADE_DATA,
    save: async (data: GradeData) => {
      box.writes.push(data);
    },
  };
  return box;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debouncedStorage', () => {
  it('writes nothing until the delay elapses', async () => {
    const inner = recording();
    const storage = debouncedStorage(inner, 100);

    void storage.save(dataWith('A'));

    expect(inner.writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(inner.writes).toHaveLength(1);
  });

  it('collapses a burst into a single write of the newest data', async () => {
    const inner = recording();
    const storage = debouncedStorage(inner, 100);

    void storage.save(dataWith('A'));
    await vi.advanceTimersByTimeAsync(40);
    void storage.save(dataWith('A', 'B'));
    await vi.advanceTimersByTimeAsync(40);
    void storage.save(dataWith('A', 'B', 'C'));
    await vi.advanceTimersByTimeAsync(100);

    expect(inner.writes).toHaveLength(1);
    expect(inner.writes[0].courses.map(c => c.name)).toEqual(['A', 'B', 'C']);
  });

  it('settles every superseded save with the write that replaced it', async () => {
    const inner = recording();
    const storage = debouncedStorage(inner, 100);
    const settled: string[] = [];

    void storage.save(dataWith('A')).then(() => settled.push('first'));
    void storage.save(dataWith('B')).then(() => settled.push('second'));

    await vi.advanceTimersByTimeAsync(100);

    // The first caller isn't left hanging just because its data was replaced.
    expect(settled).toEqual(['first', 'second']);
  });

  it('rejects the waiters when the write fails', async () => {
    const inner = recording();
    inner.save = async () => {
      throw new Error('offline');
    };
    const storage = debouncedStorage(inner, 100);

    const pending = storage.save(dataWith('A'));
    const caught = pending.catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(100);

    expect(await caught).toBe('offline');
  });

  it('flush writes immediately and cancels the pending timer', async () => {
    const inner = recording();
    const storage = debouncedStorage(inner, 10_000);

    void storage.save(dataWith('A'));
    await storage.flush();

    expect(inner.writes).toHaveLength(1);

    // The timer must not fire a second, duplicate write afterwards.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(inner.writes).toHaveLength(1);
  });

  it('flush with nothing pending is a no-op', async () => {
    const inner = recording();
    const storage = debouncedStorage(inner, 100);

    await storage.flush();

    expect(inner.writes).toHaveLength(0);
  });

  it('cancel drops the pending write', async () => {
    const inner = recording();
    const storage = debouncedStorage(inner, 100);

    void storage.save(dataWith('A'));
    storage.cancel();
    await vi.advanceTimersByTimeAsync(100);

    expect(inner.writes).toHaveLength(0);
  });

  it('passes reads straight through', async () => {
    const inner = recording();
    inner.load = async () => dataWith('Loaded');
    const storage = debouncedStorage(inner, 100);

    expect((await storage.load()).courses.map(c => c.name)).toEqual(['Loaded']);
  });

  it('queues a save that arrives while a write is in flight', async () => {
    const inner = recording();
    let release: () => void = () => {};
    inner.save = async (data: GradeData) => {
      inner.writes.push(data);
      await new Promise<void>(resolve => {
        release = resolve;
      });
    };
    const storage = debouncedStorage(inner, 100);

    void storage.save(dataWith('A'));
    await vi.advanceTimersByTimeAsync(100);
    expect(inner.writes).toHaveLength(1);

    // Arrives mid-flight; must not be folded into the write already running.
    void storage.save(dataWith('A', 'B'));
    release();
    await vi.advanceTimersByTimeAsync(100);

    expect(inner.writes).toHaveLength(2);
    expect(inner.writes[1].courses.map(c => c.name)).toEqual(['A', 'B']);
  });
});
