import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Constrains `value` to the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * `1 course` / `3 courses`.
 *
 * Adding an `s` covers every noun this app counts — course, breakdown,
 * sub-breakdown, file. Reach for a real pluralizer only when one doesn't.
 */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
