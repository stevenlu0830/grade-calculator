# Codebase Index

> Structural map of the UBC Grade Calculator. AI-optimized: paths + responsibilities, no prose.
> **Stack:** Vite 8 + React 18 + TypeScript + Tailwind 3 + shadcn/ui. No backend, no auth, no network calls.
> **Vocabulary:** Course → **Breakdown** (weighted category) → **Sub-breakdown** (one graded item). "Component" now means *React component* only.

## Quick orientation

| I want to... | Go to |
|---|---|
| Change grade math (marks totals, weighting) | [src/lib/gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Change a drop/downweight policy, or add one | [src/lib/gradePolicies.ts](src/lib/gradePolicies.ts) |
| Change the breakdown types offered, or sub-breakdown auto-naming | [src/lib/breakdownPresets.ts](src/lib/breakdownPresets.ts) |
| Change how a grade is displayed (colour, letter, decimals) | [src/lib/gradeFormatting.ts](src/lib/gradeFormatting.ts) |
| Change state shape, persistence, or migrate saved data | [src/hooks/useGradeStore.ts](src/hooks/useGradeStore.ts), [src/lib/courseStorage.ts](src/lib/courseStorage.ts) |
| Change the CSV format | [src/lib/csvExport.ts](src/lib/csvExport.ts) + [src/lib/csvImport.ts](src/lib/csvImport.ts) |
| Change the PDF report | [src/lib/pdfExport.ts](src/lib/pdfExport.ts) |
| Change the add-course / add-breakdown dialogs | [NewCourseDialog.tsx](src/components/NewCourseDialog.tsx), [AddBreakdownDialog.tsx](src/components/AddBreakdownDialog.tsx) |
| Change page layout / header | [src/pages/Index.tsx](src/pages/Index.tsx), [src/components/CourseToolbar.tsx](src/components/CourseToolbar.tsx) |
| Change colours or animations | [src/index.css](src/index.css), [tailwind.config.ts](tailwind.config.ts) |

## Layering

Dependencies point one way. Nothing in `lib/` imports React.

```
pages / components  →  hooks  →  lib (domain + format + io)  →  types
```

- **Domain** (`gradeCalculations`, `gradePolicies`, `breakdownPresets`) — pure logic, no DOM, no Tailwind.
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

- `Course` — `{ id, name, breakdowns }`
- `Breakdown` — `{ id, courseId, name, weight, dropLowestCount, downweightLowestCount, downweightPercent, subBreakdownLabel, subBreakdowns }`
  - `subBreakdownLabel` is the singular noun used to auto-name rows ("Assignment" → "Assignment 3").
- `SubBreakdown` — `{ id, breakdownId, name, achievedMarks: number | null, fullMarks: number | null }`
  - `achievedMarks` is **marks scored, not a percentage**. `null` = not entered, never 0.
  - `fullMarks: number | null` — blank until entered; the row is excluded from totals until then. Never clamps `achievedMarks`, so bonus marks are allowed.
- `AdvancedOption` — `'none' | 'dropLowest' | 'downweight'` (derived, never persisted).

## Domain — `src/lib/gradeCalculations.ts`

- `clampPercentage(v)` — `[0, 100]`, used **only** for picking a letter grade; a breakdown's own percentage is never clamped.
- `getEnteredMarks(subBreakdowns)` — scored rows only; skips rows with no full marks yet and rows worth 0 marks (can't divide by them). Marks above full marks are kept.
- **Precision:** full float64 throughout, no intermediate rounding. Rounding happens once, in `gradeFormatting`.
- `calculateBreakdownGrade(breakdown)` — **total achieved / total available**, as a percentage. `null` if ungraded; single score bypasses policies; otherwise dispatches on `getActiveAdvancedOption`.
- `calculateWeightedValue(breakdown)` — the breakdown's contribution in points.
- `calculateCourseGrade(breakdowns)` — sums `calculateWeightedValue`; `null` if nothing qualifies. Does **not** validate weights.
- `areWeightsValid(breakdowns)` — the single 100% gate, `1e-9` tolerance so float drift can't hide a valid grade. Used by `CourseSection` **and** `pdfExport`.
- Constants: `PERCENTAGE_MIN/MAX`, `LEGACY_FULL_MARKS` (100, for reading v1 data and pre-`Full Marks` CSVs only), `REQUIRED_TOTAL_WEIGHT`.

## Policies — `src/lib/gradePolicies.ts`

Domain rules shared by the calculator and the toggle UI so they can't disagree. Operates on `MarkPair { achieved, full }`.

- `getActiveAdvancedOption(breakdown)` — derives the mode from field nullability. Drop wins if both set.
- `advancedOptionUpdate(option)` — the field changes that switch modes, clearing the replaced policy.
- `percentageOf` / `sortByPercentage` — ranking is **by percentage**, so 4/10 ranks below 15/20.
- `totalPercentage(pairs)` — summed marks over summed availability; `null` if nothing available.
- `applyDropLowest(sorted, count)` — drops N worst; their `full` leaves the denominator too. Keeps ≥1.
- `applyDownweightLowest(sorted, count, percent)` — scales both sides of the fraction; `null` if all weight vanishes.
- `clampPercent`, `DEFAULT_DROP_LOWEST_COUNT`, `DEFAULT_DOWNWEIGHT_COUNT`, `DEFAULT_DOWNWEIGHT_PERCENT`.

## Presets — `src/lib/breakdownPresets.ts`

- `BREAKDOWN_PRESETS` — the 11 offered types, each with an explicit `singular` (spelled out, because rules mangle Quizzes/WebWorks).
- `OTHER_BREAKDOWN` — sentinel for "Others (Specify)".
- `presetFor(label)` — preset lookup; an unknown name is its own singular.
- `nextSubBreakdownName(label, existingNames)` — `<label> <n>`, continuing past the highest number used so deletions don't cause collisions.

## Presentation — `src/lib/gradeFormatting.ts`

- `DISPLAY_DECIMALS` (2) — the single rounding point in the whole app.
- `formatGrade(grade)` — rounded to `DISPLAY_DECIMALS`, or `—`.
- `formatWeight(weight)` — up to 2 decimals, trailing zeros dropped, so a 99.99 shortfall doesn't render as "100.0".
- `getLetterGrade(grade)` — UBC scale from the `LETTER_SCALE` table.
- `getGradeColor` / `getGradeBg` — one `COLOUR_BANDS` table pairing text + background.
- `NO_GRADE` — the `—` placeholder.

⚠️ Two scales coexist deliberately: colour bands at 90/80/70/60, letter grades on the UBC scale. An 82 is green and an `A-`.

## State — `src/hooks/useGradeStore.ts`

- `useState<Course[]>` + `useEffect` autosave through an injected `CourseStorage` (defaults to `localCourseStorage`).
- **Not a Context.** Called once in `Index.tsx`; a second call would be a rival state tree racing the same key.
- `mapCourse` / `mapBreakdown` helpers keep nested immutable updates flat.
- Actions: `addCourse(name)`, `deleteCourse`, `updateCourseName`, `addBreakdown(courseId, NewBreakdown)`, `deleteBreakdown`, `updateBreakdown`, `addSubBreakdown`, `deleteSubBreakdown`, `updateSubBreakdown`, `importCourses`.
- Exports the `NewBreakdown` input type (`{ name, weight, subBreakdownLabel }`).
- Invariants: a breakdown keeps ≥1 sub-breakdown; **marks are stored verbatim with no clamping**; new breakdowns seed one auto-named row with both mark fields blank.

## Persistence & I/O seams

- [src/lib/courseStorage.ts](src/lib/courseStorage.ts) — `CourseStorage` interface + `localCourseStorage`. Key `ubc-grade-calculator-data`, stored as `{ version, courses }` (`SCHEMA_VERSION = 2`). `migrate(raw)` converts bare v1 `components`/`grade` data, defaulting `fullMarks` to `LEGACY_FULL_MARKS` so migrated courses compute identically (new rows start blank).
- [src/lib/download.ts](src/lib/download.ts) — `downloadBlob`. The **only** place the app hands a file to the browser.
- [src/lib/id.ts](src/lib/id.ts) — `createId()`, `crypto.randomUUID()` with a fallback.
- [src/lib/exportFormat.ts](src/lib/exportFormat.ts) — `timestampedFilename`, `firstRowOnly` (the blank-repeat-parent convention both exports share).

## Import / export

- [src/lib/csvExport.ts](src/lib/csvExport.ts) — 9-column `CSV_HEADERS`, `buildCoursesCsv` (**pure**, fully tested), `exportToCSV`.
- [src/lib/csvImport.ts](src/lib/csvImport.ts) — `parseCSV`: `parseLine` (tokenise) → `resolveColumns` → tree build. `COLUMN_ALIASES` maps each column to its current *and* legacy header, so pre-rename CSVs still import; a missing `Full Marks` defaults to 100.
  - ⚠️ Splits on `\n` before quote parsing → a quoted field containing a newline tears across rows.
- [src/lib/pdfExport.ts](src/lib/pdfExport.ts) — `buildReportRows` (**pure**) + `renderCourse` + `exportToPDF`. Marks print as `18 / 20`. `AutoTableDocument` types the plugin's `lastAutoTable.finalY` locally.

## Components — `src/components/`

Presentational; state arrives as props. None read the store.

- [CourseSection.tsx](src/components/CourseSection.tsx) (133) — one course. Gates the final grade on `areWeightsValid`; owns its own `AddBreakdownDialog` instance.
- [BreakdownCard.tsx](src/components/BreakdownCard.tsx) (133) — one breakdown. Local UI state: `isOpen`, `showAdvanced`.
- [SubBreakdownRow.tsx](src/components/SubBreakdownRow.tsx) (80) — name, `achieved / full` mark inputs, and the row's own percentage.
- [AdvancedOptions.tsx](src/components/AdvancedOptions.tsx) (128) — two switches, driven entirely by `gradePolicies`. Holds no rules of its own.
- [NewCourseDialog.tsx](src/components/NewCourseDialog.tsx) (74) — prompts for a course name; Add disabled while blank.
- [AddBreakdownDialog.tsx](src/components/AddBreakdownDialog.tsx) (127) — preset picker + "Others (Specify)" free text + weight, in a `<form>` so Return submits. Caps the dropdown with `max-h-56`.
- [NumberInput.tsx](src/components/NumberInput.tsx) (26) — `<Input type="number">` that blurs on wheel so scrolling can't rewrite a mark. **Use this for every numeric field.**
- [GradeDisplay.tsx](src/components/GradeDisplay.tsx) (43) — the only grade-rendering surface.
- [CourseToolbar.tsx](src/components/CourseToolbar.tsx) (63) — header import/export/new-course actions and their toasts.

## Pages & hooks

- [src/pages/Index.tsx](src/pages/Index.tsx) (114) — owns the store, header, empty state, `NewCourseDialog`, and the horizontal snap carousel.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) (24) — 404.
- [src/hooks/useCsvImport.ts](src/hooks/useCsvImport.ts) (56) — hidden file input, read, parse, toast. Shared by the toolbar and the empty state.
- [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) — 768px hook; used only by `ui/sidebar`.
- [src/hooks/use-toast.ts](src/hooks/use-toast.ts) — shadcn toast reducer; app code uses `sonner` instead.
- [src/lib/utils.ts](src/lib/utils.ts) — `cn()` and `clamp(value, min, max)`.

## UI kit — `src/components/ui/` (48 files)

shadcn/ui over Radix. **Vendored — do not hand-edit**; re-add via CLI.
⚠️ One deliberate local fix: [select.tsx](src/components/ui/select.tsx) caps `SelectContent`/Viewport to `--radix-select-content-available-height` and lets the viewport scroll. Upstream's fixed viewport height let long option lists run off screen. Re-running `shadcn add select` reverts it.
14 are imported by app code (`alert`, `button`, `card`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `sonner`, `switch`, `toast`, `toaster`, `tooltip`), 4 more only by other `ui/` files, and **30 are unused**.
→ Per-file explanations, plus `public/`, in [UI_GUIDE.md](UI_GUIDE.md).

## Styling

- [src/index.css](src/index.css) — Tailwind layers, Google Fonts import, all HSL vars for `:root` and `.dark` including `--grade-*`, the `.grade-display` utility, and the rule hiding number-input spinner arrows.
- [tailwind.config.ts](tailwind.config.ts) — maps vars to tokens; `fade-in`/`scale-in`; `darkMode: ["class"]`.
- ⚠️ `next-themes` is installed but no provider is mounted — **dark mode is unreachable**.

## Tests — `src/test/`, 172 across 8 files

All tests live here, one file per module, importing via `@/lib/...`:
[gradeCalculations](src/test/gradeCalculations.test.ts) · [gradePolicies](src/test/gradePolicies.test.ts) · [gradeFormatting](src/test/gradeFormatting.test.ts) · [breakdownPresets](src/test/breakdownPresets.test.ts) · [courseStorage](src/test/courseStorage.test.ts) (v1 migration) · [csvExport](src/test/csvExport.test.ts) (round trip) · [csvImport](src/test/csvImport.test.ts) (incl. legacy headers) · [pdfExport](src/test/pdfExport.test.ts).
[setup.ts](src/test/setup.ts) provides `jest-dom` + a `matchMedia` stub. Untested: React components.

## Build & config

- [vite.config.ts](vite.config.ts) — port **8080**, `@` → `./src`, `lovable-tagger` in dev only.
- [vitest.config.ts](vitest.config.ts) — jsdom, globals on.
- [.claude/launch.json](.claude/launch.json) — dev-server config for tooling.
- [tsconfig.app.json](tsconfig.app.json) — ⚠️ `strict: false`. Types are advisory.
- Lockfiles: both `bun.lock` and `package-lock.json` exist. ⚠️ Pick one.
