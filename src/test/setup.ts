import "@testing-library/jest-dom";

/**
 * A browser's `localStorage`, which the test environment doesn't supply.
 *
 * jsdom 20 leaves `window.localStorage` undefined here, and Node's same-named
 * global is undefined unless the process was started with `--localstorage-file`.
 * App code writes bare `localStorage` because that is what a browser gives it,
 * so stand one up rather than bending the app around the test environment.
 */
const memoryStorage = (): Storage => {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, String(value)),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
  } as Storage;
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryStorage(),
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: globalThis.localStorage,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
