# Codebase Index

> Structural map of the UBC Grade Calculator. AI-optimized: paths + responsibilities, no prose.
> **Stack:** Vite 8 + React 18 + TypeScript + Tailwind 3 + shadcn/ui. No backend, no auth, no network calls.

## Quick orientation

| I want to... | Go to |
|---|---|
| Change grade math (drop/downweight/weighting) | [src/lib/gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Change state shape or persistence | [src/hooks/useGradeStore.ts](src/hooks/useGradeStore.ts), [src/types/grades.ts](src/types/grades.ts) |
| Change CSV/PDF export or CSV import | [src/lib/exportImport.ts](src/lib/exportImport.ts) |
| Change page layout / header / toolbar | [src/pages/Index.tsx](src/pages/Index.tsx) |
| Change colors, grade color bands, animations | [src/index.css](src/index.css), [tailwind.config.ts](tailwind.config.ts) |
| Add a route | [src/App.tsx](src/App.tsx) |

## Entry points

- [index.html](index.html) — Vite HTML shell; mounts `#root`, loads `/src/main.tsx`.
- [src/main.tsx](src/main.tsx) — 5 lines. `createRoot(...).render(<App />)`. Imports `index.css`.
- [src/App.tsx](src/App.tsx) — provider stack + router.
  - Providers, outermost→innermost: `QueryClientProvider` → `TooltipProvider` → `Toaster` (shadcn) + `Sonner` → `BrowserRouter`.
  - Routes: `/` → `Index`, `*` → `NotFound`.
  - Note: `@tanstack/react-query` is mounted but **unused** — no queries/mutations exist anywhere.

## Domain model — `src/types/grades.ts`

Three-level tree. Parent IDs are denormalized onto children (`componentId`, `courseId`).

- `Course` — `{ id, name, components: Component[] }`
- `Component` — `{ id, courseId, name, weight, dropLowestCount, downweightLowestCount, downweightPercent, subComponents }`
  - All numeric fields are `number | null`; `null` = "not set", never `0`.
- `SubComponent` — `{ id, componentId, name, grade: number | null }`
- `AdvancedOption` — `'none' | 'dropLowest' | 'downweight'` (derived, not stored).

## State — `src/hooks/useGradeStore.ts`

- Single hook, `useState<Course[]>` + `useEffect` autosave. **Not a context** — instantiated once in `Index.tsx`.
- Persistence: `localStorage` key `ubc-grade-calculator-data`; loaded lazily in `useState` initializer, written on every `courses` change.
- IDs: `Math.random().toString(36).substr(2, 9)` (also duplicated in `exportImport.ts`).
- Exported actions (all `useCallback`, all immutable spread updates):
  - Course: `addCourse`, `deleteCourse`, `updateCourseName`
  - Component: `addComponent`, `deleteComponent`, `updateComponent(courseId, componentId, Partial<Component>)`
  - Sub: `addSubComponent`, `deleteSubComponent`, `updateSubComponent(..., Partial<SubComponent>)`
  - Bulk: `importCourses(Course[])` — replaces entire state
- Invariants enforced here:
  - `deleteSubComponent` refuses to remove the last sub-component of a component.
  - `updateSubComponent` clamps `grade` to `[0, 100]`.
  - New components are seeded with exactly one empty sub-component.

## Business logic — `src/lib/gradeCalculations.ts`

Pure functions, no React. The single source of grade truth.

- `calculateSubComponentGrades(subs)` — non-null grades only.
- `calculateComponentGrade(component)` → `number | null`
  - `null` if no grades; passthrough if exactly one grade (drop/downweight are skipped).
  - Precedence: **dropLowest wins over downweight** if both are somehow set.
  - `dropLowest`: sorts ascending, drops `min(N, len-1)` — always keeps ≥1 grade.
  - `downweight`: multiplies the N lowest by `1 - pct/100` in a weighted mean.
  - Fallback: unweighted mean.
- `calculateWeightedValue(component)` — `componentGrade * weight / 100`.
- `calculateCourseGrade(components)` — sums weighted values; `null` if no component has both a grade and a weight. **Does not validate that weights sum to 100** — callers do.
- `getTotalWeight(components)` — sum of weights, `null` treated as 0.
- Presentation helpers: `getGradeColor`, `getGradeBg` (5 bands at 90/80/70/60), `formatGrade` (1 dp, `—` for null), `getLetterGrade` (UBC scale: A+ ≥90, A ≥85, A- ≥80, B+ ≥76, B ≥72, B- ≥68, C+ ≥64, C ≥60, C- ≥55, D ≥50, else F).

⚠️ Two different thresholds coexist: color bands use 90/80/70/60; letter grades use the UBC scale. Intentional.

## Import/export — `src/lib/exportImport.ts`

- `exportToCSV(courses)` — flat 8-column rows, one per sub-component; parent columns blanked on repeat rows (`index === 0` pattern). Manual quote escaping. Downloads via Blob + synthetic `<a>` click. Filename `grades_export_<YYYY-MM-DD>.csv`.
- `exportToPDF(courses)` — `jspdf` + `jspdf-autotable`. Per-course heading; final grade printed **only when total weight === 100**, else a warning line. Filename `grades_report_<YYYY-MM-DD>.pdf`.
- `parseCSV(text)` → `Course[]` — hand-rolled parser (no library).
  - Handles quoted fields and `""` escapes; splits on unquoted commas.
  - Maps columns **by header name** with positional fallback → tolerates reordered/extra columns.
  - Blank course/component cells inherit from the previous row (the export's sparse format).
  - Clamps imported grades to `[0, 100]`; guarantees ≥1 sub-component per component.
  - ⚠️ Splits on `\n` before quote parsing → embedded newlines in quoted fields break rows.

## Feature components — `src/components/`

Presentational + prop-drilled callbacks. None read the store directly.

- [CourseSection.tsx](src/components/CourseSection.tsx) (132) — one course card. Computes `getTotalWeight`; shows the "weights must sum to 100%" alert and gates the final grade on `totalWeight === 100`. Renders `ComponentCard[]`.
- [ComponentCard.tsx](src/components/ComponentCard.tsx) (145) — one component. Local UI state: `isOpen` (collapsible), `showAdvanced`. Weight input, component grade, weighted contribution, delete. Renders `SubComponentRow[]` + `AdvancedOptions`.
- [SubComponentRow.tsx](src/components/SubComponentRow.tsx) (61) — name + grade `/100` inputs; delete disabled via `canDelete` prop when it's the last row.
- [AdvancedOptions.tsx](src/components/AdvancedOptions.tsx) (157) — two mutually-exclusive switches. Derives `activeOption` from which count field is non-null; each toggle nulls the other mode's fields. Defaults: drop → 1; downweight → 1 @ 50%.
- [GradeDisplay.tsx](src/components/GradeDisplay.tsx) (43) — the only grade-rendering surface. `size` sm/md/lg, optional background tint and letter grade.
- [NavLink.tsx](src/components/NavLink.tsx) (28) — router `NavLink` wrapper accepting `activeClassName`/`pendingClassName`. **Currently unused** (no nav exists).

## Pages — `src/pages/`

- [Index.tsx](src/pages/Index.tsx) (205) — the entire app. Owns the store, header toolbar (Import / Export dropdown / New Course), hidden `<input type="file">` for CSV import, empty state, and the horizontally-scrolling snap carousel of `CourseSection`s. All toasts fire from here via `sonner`.
- [NotFound.tsx](src/pages/NotFound.tsx) (24) — 404, logs the bad path.

## UI kit — `src/components/ui/` (49 files)

Unmodified shadcn/ui primitives over Radix. **Treat as vendored** — do not hand-edit; re-add via CLI. Only a handful are actually imported: `button`, `input`, `card`, `label`, `switch`, `tooltip`, `collapsible`, `alert`, `dropdown-menu`, `sonner`, `toaster`. The rest are unused scaffolding.

## Hooks & utils

- [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) — 768px media-query hook (unused by app code; used by `ui/sidebar`).
- [src/hooks/use-toast.ts](src/hooks/use-toast.ts) + [src/components/ui/use-toast.ts](src/components/ui/use-toast.ts) — shadcn toast reducer. **Duplicated file.** App code uses `sonner` instead.
- [src/lib/utils.ts](src/lib/utils.ts) — `cn()` = `clsx` + `tailwind-merge`.

## Styling

- [src/index.css](src/index.css) (128) — Tailwind layers, Google Fonts `@import` (Inter + JetBrains Mono), all HSL CSS variables for `:root` and `.dark`, including `--grade-excellent|good|average|passing|failing`. Defines the `.grade-display` utility.
- [tailwind.config.ts](tailwind.config.ts) — maps CSS vars to Tailwind color tokens (`grade-*`, `warning`, `sidebar-*`); `fade-in`/`scale-in` keyframes; `darkMode: ["class"]`.
- ⚠️ `next-themes` is a dependency but no `ThemeProvider` is mounted — **dark mode is unreachable at runtime**.
- [src/App.css](src/App.css) — leftover Vite template CSS, **not imported anywhere**.

## Tests — `src/test/`

- [setup.ts](src/test/setup.ts) — `jest-dom` + `matchMedia` stub for jsdom.
- [example.test.ts](src/test/example.test.ts) — placeholder `expect(true).toBe(true)`. **No real coverage.**
- Highest-value untested surface: `gradeCalculations.ts` and `parseCSV`.

## Build & config

- [vite.config.ts](vite.config.ts) — port **8080**, host `::`, HMR overlay off, `@` → `./src`, `lovable-tagger` in dev mode only.
- [vitest.config.ts](vitest.config.ts) — jsdom, globals on, separate from `vite.config.ts`.
- [tsconfig.app.json](tsconfig.app.json) — ⚠️ `strict: false`, `noImplicitAny: false`, unused-vars off. Types are advisory.
- [eslint.config.js](eslint.config.js) — flat config; `@typescript-eslint/no-unused-vars` disabled.
- [components.json](components.json) — shadcn config: `default` style, slate base, CSS variables.
- Lockfiles: both `bun.lock` (committed) and `package-lock.json` (untracked) exist. ⚠️ Pick one.
