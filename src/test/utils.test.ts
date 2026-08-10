import { describe, it, expect } from 'vitest';
import { clamp, plural } from '@/lib/utils';

describe('clamp', () => {
  it('constrains to the inclusive range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('keeps the bounds themselves', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('plural', () => {
  it('leaves a single item singular', () => {
    expect(plural(1, 'course')).toBe('1 course');
  });

  it('adds an s to everything else, zero included', () => {
    expect(plural(0, 'course')).toBe('0 courses');
    expect(plural(3, 'breakdown')).toBe('3 breakdowns');
  });

  it('handles the hyphenated noun the delete dialogs use', () => {
    expect(plural(2, 'sub-breakdown')).toBe('2 sub-breakdowns');
  });
});
