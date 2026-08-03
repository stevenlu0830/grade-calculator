# Codebase Index

> Structural map of the UBC Grade Calculator. AI-optimized: paths + responsibilities, no prose.
> **Stack:** Vite 8 + React 18 + TypeScript + Tailwind 3 + shadcn/ui. No backend, no auth, no network calls.

## Quick orientation

| I want to... | Go to |
|---|---|
| Change grade math (averaging, weighting, totals) | [src/lib/gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Change a drop/downweight policy, or add one | [src/lib/gradePolicies.ts](src/lib/gradePolicies.ts) |
| Change how a grade is displayed (colour, letter, decimals) | [src/lib/gradeFormatting.ts](src/lib/gradeFormatting.ts) |
| Change state shape or persistence | [src/hooks/useGradeStore.ts](src/hooks/useGradeStore.ts), [src/lib/courseStorage.ts](src/lib/courseStorage.ts) |
| Change the CSV format | [src/lib/csvExport.ts](src/lib/csvExport.ts) + [src/lib/csvImport.ts](src/lib/csvImport.ts) |
| Change the PDF report | [src/lib/pdfExport.ts](src/lib/pdfExport.ts) |
| Change page layout / header | [src/pages/Index.tsx](src/pages/Index.tsx), [src/components/CourseToolbar.tsx](src/components/CourseToolbar.tsx) |
| Change colours or animations | [src/index.css](src/index.css), [tailwind.config.ts](tailwind.config.ts) |
| Add a route | [src/App.tsx](src/App.tsx) |

## Layering

Dependencies point one way. Nothing in `lib/` imports React.

```
pages / components  →  hooks  →  lib (domain + format + io)  →  types
```

- **Domain** (`gradeCalculations`, `gradePolicies`) — pure maths, no DOM, no Tailwind.
- **Presentation** (`gradeFormatting`) — grade → string/class. Imports domain, never the reverse.
- **I/O** (`csvExport`, `csvImport`, `pdfExport`) — pure builders + a thin effectful wrapper.
- **Seams** (`courseStorage`, `download`) — the only modules that touch `localStorage` / the DOM directly.

## Entry points

- [index.html](index.html) — Vite shell; mounts `#root`.
- [src/main.tsx](src/main.tsx) — `createRoot(...).render(<App />)`; imports `index.css`.
- [src/App.tsx](src/App.tsx) — providers `QueryClientProvider` → `TooltipProvider` → `Toaster` + `Sonner` → `BrowserRouter`. Routes: `/` → `Index`, `*` → `NotFound`.
  - `@tanstack/react-query` is mounted but **unused** — zero queries anywhere.

## Domain model — `src/types/grades.ts`

Three-level tree; parent IDs denormalized onto children.

- `Course` — `{ id, name, components }`
- `Component` — `{ id, courseId, name, weight, dropLowestCount, downweightLowestCount, downweightPercent, subComponents }`
  - Numeric fields are `number | null`; `null` = "not set", never `0`.
- `SubComponent` — `{ id, componentId, name, grade: number | null }`
- `AdvancedOption` — `'none' | 'dropLowest' | 'downweight'` (derived, never persisted).

## Domain — `src/lib/gradeCalculations.ts`

- `clampGrade(v)` — the one grade clamp; used by the store and the CSV importer.
- `calculateSubComponentGrades(subs)` — entered grades only.
- `calculateComponentGrade(component)` — `null` if ungraded; passthrough on a single grade (policies skipped); otherwise dispatches on `getActiveAdvancedOption` to the matching policy.
- `calculateWeightedValue(component)` — a component's contribution in points.
- `calculateCourseGrade(components)` — sums `calculateWeightedValue`; `null` if nothing qualifies. Does **not** validate weights.
- `getTotalWeight(components)` — sum, `null` counted as 0.
- `areWeightsValid(components)` — the single 100% gate, with a `1e-9` tolerance so float drift can't hide a valid final grade. Used by `CourseSection` **and** `pdfExport`.
- Constants: `GRADE_MIN`, `GRADE_MAX`, `REQUIRED_TOTAL_WEIGHT`.

## Policies — `src/lib/gradePolicies.ts`

Domain rules for the two advanced options; shared by the calculator and the toggle UI so they can't disagree.

- `getActiveAdvancedOption(component)` — derives the mode from field nullability. Drop wins if both set.
- `advancedOptionUpdate(option)` — the field changes that switch modes, clearing the policy being replaced. Encodes mutual exclusivity.
- `applyDropLowest(sorted, count)` — mean after dropping N; always keeps ≥1.
- `applyDownweightLowest(sorted, count, percent)` — weighted mean; returns `null` when every grade is discounted to zero weight.
- `clampPercent(v)`, plus `DEFAULT_DROP_LOWEST_COUNT` / `DEFAULT_DOWNWEIGHT_COUNT` / `DEFAULT_DOWNWEIGHT_PERCENT`.

## Presentation — `src/lib/gradeFormatting.ts`

- `formatGrade(grade)` — one decimal, or `—`.
- `formatWeight(weight)` — up to 2 decimals, trailing zeros dropped, so a 99.99 shortfall doesn't render as "100.0".
- `getLetterGrade(grade)` — UBC scale from the `LETTER_SCALE` table.
- `getGradeColor` / `getGradeBg` — from one `COLOUR_BANDS` table pairing text + background.
- `NO_GRADE` — the `—` placeholder.

⚠️ Two scales coexist deliberately: colour bands at 90/80/70/60, letter grades on the UBC scale. An 82 is green and an `A-`.

## State — `src/hooks/useGradeStore.ts`

- `useState<Course[]>` + `useEffect` autosave, persisting through an injected `CourseStorage` (defaults to `localCourseStorage`).
- **Not a Context.** Called once in `Index.tsx`; a second call would be a rival state tree racing the same key.
- Internal `mapCourse` / `mapComponent` helpers keep the nested immutable updates flat.
- Actions: `addCourse`, `deleteCourse`, `updateCourseName`, `addComponent`, `deleteComponent`, `updateComponent`, `addSubComponent`, `deleteSubComponent`, `updateSubComponent`, `importCourses`.
- Invariants: a component keeps ≥1 sub-component; grades clamp on write; new components seed one empty row.

## Persistence & I/O seams

- [src/lib/courseStorage.ts](src/lib/courseStorage.ts) — `CourseStorage` interface + `localCourseStorage`. Key `ubc-grade-calculator-data`. Both ops degrade to a console error.
- [src/lib/download.ts](src/lib/download.ts) — `downloadBlob`. The **only** place the app hands a file to the browser.
- [src/lib/id.ts](src/lib/id.ts) — `createId()`, `crypto.randomUUID()` with a fallback.
- [src/lib/exportFormat.ts](src/lib/exportFormat.ts) — `timestampedFilename`, `firstRowOnly` (the blank-repeat-parent convention both exports share).

## Import / export

- [src/lib/csvExport.ts](src/lib/csvExport.ts) — `CSV_HEADERS`, `buildCoursesCsv` (**pure**, fully tested), `exportToCSV` (wrapper → `downloadBlob`).
- [src/lib/csvImport.ts](src/lib/csvImport.ts) — `parseCSV`, split into `parseLine` (tokenise) → `resolveColumns` (header-name mapping with positional fallback) → tree building. Blank parent cells inherit from the row above.
  - ⚠️ Splits on `\n` before quote parsing → a quoted field containing a newline tears across rows.
- [src/lib/pdfExport.ts](src/lib/pdfExport.ts) — `buildReportRows` (**pure**) + `renderCourse` + `exportToPDF`. `AutoTableDocument` types the plugin's `lastAutoTable.finalY` locally.

## Components — `src/components/`

Presentational; state arrives as props. None read the store.

- [CourseSection.tsx](src/components/CourseSection.tsx) (133) — one course. Gates the final grade on `areWeightsValid`; shows the shortfall alert via `formatWeight`.
- [ComponentCard.tsx](src/components/ComponentCard.tsx) (145) — one component. Local UI state: `isOpen`, `showAdvanced`.
- [SubComponentRow.tsx](src/components/SubComponentRow.tsx) (61) — name + grade inputs; delete gated by `canDelete`.
- [AdvancedOptions.tsx](src/components/AdvancedOptions.tsx) (134) — two switches, driven entirely by `gradePolicies`. Holds no rules of its own.
- [GradeDisplay.tsx](src/components/GradeDisplay.tsx) (43) — the only grade-rendering surface.
- [CourseToolbar.tsx](src/components/CourseToolbar.tsx) (63) — header import/export/new-course actions and their toasts.

## Pages & hooks

- [src/pages/Index.tsx](src/pages/Index.tsx) (107) — owns the store, renders header, empty state, and the horizontal snap carousel of courses.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) (24) — 404.
- [src/hooks/useCsvImport.ts](src/hooks/useCsvImport.ts) (56) — hidden file input, read, parse, toast. Shared by the toolbar and the empty state.
- [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) — 768px hook; used only by `ui/sidebar`.
- [src/hooks/use-toast.ts](src/hooks/use-toast.ts) — shadcn toast reducer; app code uses `sonner` instead.
- [src/lib/utils.ts](src/lib/utils.ts) — `cn()` and `clamp(value, min, max)`.

## UI kit — `src/components/ui/` (48 files)

Unmodified shadcn/ui over Radix. **Vendored — do not hand-edit**; re-add via CLI.
12 are imported by app code (`alert`, `button`, `card`, `collapsible`, `dropdown-menu`, `input`, `label`, `sonner`, `switch`, `toast`, `toaster`, `tooltip`), 5 more only by other `ui/` files, and **31 are unused**.
→ Per-file explanations, plus `public/`, in [UI_GUIDE.md](UI_GUIDE.md).

## Styling

- [src/index.css](src/index.css) — Tailwind layers, Google Fonts import, all HSL vars for `:root` and `.dark` including `--grade-*`, and the `.grade-display` utility.
- [tailwind.config.ts](tailwind.config.ts) — maps vars to tokens; `fade-in`/`scale-in`; `darkMode: ["class"]`.
- ⚠️ `next-themes` is installed but no provider is mounted — **dark mode is unreachable**.

## Tests — `src/test/`, 123 across 6 files

All tests live here, one file per module under test, importing via `@/lib/...`:
[gradeCalculations](src/test/gradeCalculations.test.ts) · [gradePolicies](src/test/gradePolicies.test.ts) · [gradeFormatting](src/test/gradeFormatting.test.ts) · [csvExport](src/test/csvExport.test.ts) (incl. export→import round trip) · [csvImport](src/test/csvImport.test.ts) · [pdfExport](src/test/pdfExport.test.ts).
[setup.ts](src/test/setup.ts) provides `jest-dom` + a `matchMedia` stub. Untested: React components.

## Build & config

- [vite.config.ts](vite.config.ts) — port **8080**, `@` → `./src`, `lovable-tagger` in dev only.
- [vitest.config.ts](vitest.config.ts) — jsdom, globals on.
- [.claude/launch.json](.claude/launch.json) — dev-server config for tooling.
- [tsconfig.app.json](tsconfig.app.json) — ⚠️ `strict: false`. Types are advisory.
- Lockfiles: both `bun.lock` and `package-lock.json` exist. ⚠️ Pick one.
