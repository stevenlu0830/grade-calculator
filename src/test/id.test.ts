import { describe, it, expect, afterEach, vi } from 'vitest';
import { createId } from '@/lib/id';

/**
 * Ids only have to be unique within one student's tree, but they are what every
 * `.map`/`.filter` in the store matches on, so a collision would silently edit
 * the wrong row.
 */
describe('createId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mints a different id every time', () => {
    const ids = new Set(Array.from({ length: 500 }, createId));

    expect(ids.size).toBe(500);
  });

  it('uses the browser generator when there is one', () => {
    const randomUUID = vi.fn(() => 'uuid-from-crypto');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createId()).toBe('uuid-from-crypto');
    expect(randomUUID).toHaveBeenCalled();
  });

  it('falls back where crypto has no randomUUID', () => {
    // Older browsers, and any non-DOM environment the lib is imported into.
    vi.stubGlobal('crypto', {});

    const id = createId();

    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(id.length).toBeGreaterThan(0);
  });

  it('falls back where there is no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);

    expect(new Set(Array.from({ length: 200 }, createId)).size).toBe(200);
  });
});
