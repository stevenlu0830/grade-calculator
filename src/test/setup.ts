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

/**
 * Browser APIs the Radix primitives reach for that jsdom doesn't implement.
 *
 * Without them, opening a dialog or a select throws rather than failing an
 * assertion, which makes every component test look like a component bug. Each
 * is a no-op: the tests assert on structure and behaviour, never on layout,
 * which jsdom couldn't tell them about anyway.
 */
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

if (!('PointerEvent' in globalThis)) {
  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    value: class extends MouseEvent {},
  });
}

for (const [name, value] of [
  ['scrollIntoView', () => {}],
  ['hasPointerCapture', () => false],
  ['setPointerCapture', () => {}],
  ['releasePointerCapture', () => {}],
] as const) {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { configurable: true, value });
  }
}
