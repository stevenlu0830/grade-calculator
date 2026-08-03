# Conventions

> Patterns actually observed in this codebase. Follow them; don't introduce competing ones.

## Imports

- Always `@/...` for `src` — never relative `../`. Exception: sibling components inside `src/components/` use `./BreakdownCard`.
- Order: types → local components → lib/helpers → `@/components/ui/*` → `lucide-react` icons → React hooks.
- Icons: `lucide-react` only, sized with classes (`h-4 w-4`), never an icon library mix.

## Components

- Named `export function Foo({...}: FooProps)` for feature components; `export default` **only** for pages.
- Props interface declared immediately above the component, named `<Component>Props`. Not exported.
- Callbacks are `on<Verb>` (`onUpdate`, `onDelete`, `onAddSubBreakdown`) and are prop-drilled — parents close over IDs so children never see them:
  ```tsx
  onUpdate={updates => onUpdateBreakdown(breakdown.id, updates)}
  ```
- Partial updates: mutations take `Partial<T>`, never individual field setters.
- No `React.FC`. No `memo`/`useMemo` anywhere — grade math is cheap and recomputed on render.
- Feature components are presentational: **only `Index.tsx` touches the store.** Don't call `useGradeStore` deeper in the tree.
- Local UI-only state (`isOpen`, `showAdvanced`) lives in the component. Domain state never does.

## State & data

- Immutable updates via spread + `.map`/`.filter`. Never mutate; never add Immer/Redux/Zustand.
- Every store action is wrapped in `useCallback` with `[]` deps (uses functional `setCourses(prev => ...)`).
- `null` means "not set" for all numeric fields. Never use `0` or `undefined` as the empty value.
- Nullable reads use `??`, not `||`, so a real `0` survives: `breakdown.weight ?? ''`.
- Persistence is implicit — the store's `useEffect` autosaves. Never write `localStorage` from a component.

## Layering

Dependencies point one way; keep them that way.

```
pages / components  →  hooks  →  lib  →  types
```

- `src/lib/*` never imports React. If a helper needs a hook, it belongs in `src/hooks/`.
- **Domain** (`gradeCalculations`, `gradePolicies`) must not know about Tailwind, the DOM, or display strings.
- **Presentation** (`gradeFormatting`) may import domain. Never the reverse.
- Side effects live at the edges: `courseStorage` owns `localStorage`, `download` owns the DOM. Nothing else touches either.
- Split every export into a pure builder plus a thin effectful wrapper (`buildCoursesCsv` / `exportToCSV`). Assert the builder in tests; keep the wrapper too small to break.

## Grade logic

- All maths lives in `src/lib/gradeCalculations.ts` and `src/lib/gradePolicies.ts` as pure functions. No calculation inline in JSX.
- Functions returning a grade return `number | null`; `null` propagates rather than defaulting to 0.
- A grade is **total marks achieved over total marks available**, never an average of percentages. Sum the marks; don't average the ratios.
- `achievedMarks` is marks, not a percentage, and it is **never clamped** — a score above full marks is a valid bonus. Don't add "helpful" correction on entry, on import, or when full marks change.
- Calculate at full precision and round **only** at display, via `formatGrade`/`DISPLAY_DECIMALS`. Never round inside `gradeCalculations.ts` or `gradePolicies.ts`.
- Never render a raw number: go through `formatGrade`/`formatWeight`/`GradeDisplay`.
- Gate course totals on `areWeightsValid(breakdowns)`. Never compare a weight sum with `===` — floating-point drift makes `0.01 + 64.04 + 35.95 !== 100`.
- A rule the UI and the calculator both need (which policy is active, what a toggle clears) belongs in `gradePolicies`, not in a component.

## Styling

- Tailwind utilities inline. No CSS modules, no styled-components, no new `.css` files.
- Semantic tokens only — `bg-background`, `text-muted-foreground`, `border-border`, `text-grade-good`. **Never** raw colors like `text-red-500`.
- New colors: add an HSL var to both `:root` and `.dark` in `src/index.css`, then map it in `tailwind.config.ts`.
- Conditional classes use `cn()` from `@/lib/utils`; template literals are acceptable for a single toggle.
- Numeric values get `font-mono`; the `.grade-display` utility adds `tabular-nums`.
- Entry animations: `animate-fade-in` (containers) / `animate-scale-in` (cards).

## UI kit

- `src/components/ui/*` is vendored shadcn. Don't hand-edit — add via `npx shadcn@latest add <name>` and compose wrappers instead. The one exception is `select.tsx`, patched to stop long dropdowns overflowing the window; if you must patch another, comment why inline and note it in CODEBASE_INDEX.md, since the CLI will revert it.
- Dialogs that create something wrap their fields in a `<form>` with a `type="submit"` confirm button, so Return works.
- Toasts: `import { toast } from 'sonner'`. Use `toast.success` / `toast.error`. The shadcn `use-toast` hook is legacy — don't add usages.

## TypeScript

- `strict` is **off**. Still annotate props, return types on lib functions, and avoid new `any`. Where a library forces a cast (jspdf-autotable's `lastAutoTable`), describe the shape in a named local interface and comment why.
- Domain types live in `src/types/grades.ts`. Don't redeclare shapes locally; use `Partial<Breakdown>` etc.

## Vocabulary

The domain is Course → **Breakdown** → **Sub-breakdown**. Use those words in code, UI text, CSV headers and comments alike.

- "Component" means **React component** and nothing else. Never reintroduce it as a domain term.
- New numeric fields use `NumberInput`, not raw `<Input type="number">`, so the scroll wheel can't silently rewrite a value.
- Breakdown types and their singular forms live in `breakdownPresets.ts`. Add a preset there rather than hard-coding a label in a dialog.

## Naming & files

- Feature components `PascalCase.tsx`; lib/hooks/types `camelCase.ts`; shadcn primitives stay `kebab-case.tsx`.
- One feature component per file, named after the file.
- Handlers `handle<Event>` inside components, `on<Event>` when crossing a prop boundary.

## State & IDs

- Mint IDs with `createId()` from `@/lib/id`. Never inline `Math.random()`.
- Changing the persisted shape means bumping `SCHEMA_VERSION` and extending `migrate` in `courseStorage.ts`, with a test proving old data still calculates the same. Saved data is the only thing here we cannot regenerate.
- Nested immutable updates go through the store's `mapCourse` / `mapBreakdown` helpers rather than hand-rolled nested `.map` chains.
- `useGradeStore` takes its storage as an argument. Depend on the `CourseStorage` interface, not on `localStorage`.

## Tests

- Vitest + jsdom, globals enabled; the existing files import `describe`/`it`/`expect` explicitly — match that.
- **All tests live in `src/test/`**, named `<module>.test.ts` after the module under test. Never colocate beside source.
- Tests import through the `@/` alias (`@/lib/csvExport`), never with relative paths.
- Test the pure functions; that's what the pure/effectful split is for. Components are currently untested.
- Changing behaviour deliberately? Update the test in the same commit and say why in the message. A characterization test that starts failing is either a regression or a decision — never noise to silence.

## Commits

- Short imperative subject, no scope prefix or Conventional Commits: `Fix CSV import column padding`, `Add weighted grade column to PDF`.
- Avoid the bare `Changes` messages that dominate the existing history.
