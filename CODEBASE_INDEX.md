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
| Change the save-file format | [src/lib/progressFile.ts](src/lib/progressFile.ts) |
| Change how files reach disk | [vite-plugin-progress-files.ts](vite-plugin-progress-files.ts) |
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
- **I/O** (`progressFile`) — pure builder/parser + a thin effectful wrapper.
- **Seams** (`courseStorage`, `download`) — the only modules that touch `localStorage` / the DOM directly.

## Entry points

- [index.html](index.html) — Vite shell; mounts `#root`. Declares the favicon **explicitly** (`/favicon.png?v=2`) rather than relying on the implicit `/favicon.ico` lookup, which cached hard enough to keep serving a stale icon. Bump the `?v=` when replacing the icon.
- [src/main.tsx](src/main.tsx) — `createRoot(...).render(<App />)`; imports `index.css`.
- [src/App.tsx](src/App.tsx) — providers `QueryClientProvider` → `TooltipProvider` → `Toaster` + `Sonner` → `BrowserRouter`. Routes: `/` → `Index`, `*` → `NotFound`.
  - `@tanstack/react-query` is mounted but **unused** — zero queries anywhere.

## Domain model — `src/types/grades.ts`

Three-level tree; parent IDs denormalized onto children.

- `Course` — `{ id, name, breakdowns }`
- `Breakdown` — `{ id, courseId, name, weight, dropLowestCount, downweightLowestCount, downweightPercent, fullCreditGrade, subBreakdownLabel, subBreakdowns }`
  - `fullCreditGrade: number | null` — the percentage that earns 100%. **Independent** of drop/downweight, which it composes with.
  - `subBreakdownLabel` is the singular noun used to auto-name rows ("Assignment" → "Assignment 3").
- `SubBreakdown` — `{ id, breakdownId, name, achievedMarks: number | null, fullMarks: number | null }`
  - `achievedMarks` is **marks scored, not a percentage**. `null` = not entered, never 0.
  - `fullMarks: number | null` — blank until entered; the row is excluded from totals until then. Never clamps `achievedMarks`, so bonus marks are allowed.
- `AdvancedOption` — `'none' | 'dropLowest' | 'downweight'` (derived, never persisted).

## Domain — `src/lib/gradeCalculations.ts`

- `clampPercentage(v)` — `[0, 100]`, used **only** for picking a letter grade; a breakdown's own percentage is never clamped.
- `getEnteredMarks(subBreakdowns)` — scored rows only; skips rows with no full marks yet and rows worth 0 marks (can't divide by them). Marks above full marks are kept.
- **Precision:** full float64 throughout, no intermediate rounding. Rounding happens once, in `gradeFormatting`.
- `calculateBreakdownGrade(breakdown)` — **total achieved / total available**, as a percentage, then scaled by `applyFullCreditGrade`. `null` if ungraded; a single score bypasses drop/downweight (but **not** full credit); otherwise dispatches on `getActiveAdvancedOption`.
- `calculateWeightedValue(breakdown)` — the breakdown's contribution in points.
- `calculateCourseGrade(breakdowns)` — sums `calculateWeightedValue`; `null` if nothing qualifies. Does **not** validate weights.
- `areWeightsValid(breakdowns)` — the single 100% gate, `1e-9` tolerance so float drift can't hide a valid grade. Used by `CourseSection`.
- Constants: `PERCENTAGE_MIN/MAX`, `LEGACY_FULL_MARKS` (100, for reading v1 data and pre-`Full Marks` CSVs only), `REQUIRED_TOTAL_WEIGHT`.

## Policies — `src/lib/gradePolicies.ts`

Domain rules shared by the calculator and the toggle UI so they can't disagree. Operates on `MarkPair { achieved, full }`.

- `GradingPolicy` — the four policy fields. A `Breakdown` satisfies it structurally, so the same helpers serve a saved breakdown *and* the draft a dialog holds before commit.
- `MarksPolicyFields` — the mutually-exclusive trio (drop + downweight). `fullCreditGrade` sits outside it deliberately.
- `NO_POLICY` — frozen all-nulls starting point.
- `getActiveAdvancedOption(policy)` — derives the mode from field nullability. Drop wins if both set.
- `advancedOptionUpdate(option)` — the **marks fields only** for a mode, clearing the one it replaces, so spreading it preserves `fullCreditGrade`. Returns a fresh object, never `NO_POLICY` itself.
- `applyFullCreditGrade(percentage, threshold)` — `min(100, pct / threshold * 100)`. A `null`/`undefined` threshold is a no-op; `0` awards full credit rather than dividing by zero.
- `describePolicy(policy)` — one-line summary, or `null`. **Joins** parts with ` · ` since full credit combines with a marks policy. Shared by the breakdown card and the PDF report.
- `percentageOf` / `sortByPercentage` — ranking is **by percentage**, so 4/10 ranks below 15/20.
- `totalPercentage(pairs)` — summed marks over summed availability; `null` if nothing available.
- `applyDropLowest(sorted, count)` — drops N worst; their `full` leaves the denominator too. Keeps ≥1.
- `applyDownweightLowest(sorted, count, percent)` — scales both sides of the fraction; `null` if all weight vanishes.
- `clampPercent`, `DEFAULT_DROP_LOWEST_COUNT`, `DEFAULT_DOWNWEIGHT_COUNT`, `DEFAULT_DOWNWEIGHT_PERCENT`.

## Presets — `src/lib/breakdownPresets.ts`

- `BREAKDOWN_PRESETS` — the 11 offered types in **ascending alphabetical order, case-insensitively** (so iClickers sits before In-class Exercises, not after WebWorks); each carries an explicit `singular`, spelled out because rules mangle Quizzes/WebWorks. A test enforces the ordering.
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
- Exports the `NewBreakdown` input type — `{ name, weight, subBreakdownLabel }` **extending `GradingPolicy`**, so the add dialog can set a policy up front.
- Invariants: a breakdown keeps ≥1 sub-breakdown; **marks are stored verbatim with no clamping**; new breakdowns seed one auto-named row with both mark fields blank.

## Persistence & I/O seams

- [src/lib/courseStorage.ts](src/lib/courseStorage.ts) — `CourseStorage` interface + `localCourseStorage`. Key `ubc-grade-calculator-data`, stored as `{ version, courses }`. `SCHEMA_VERSION = 3`. `migrate(raw)` converts bare v1 `components`/`grade` data (defaulting `fullMarks` to `LEGACY_FULL_MARKS`), then `normalizeCourses` backfills fields added later — `fullCreditGrade` and `fullMarks` become `null` rather than `undefined`, which a `!== null` check would otherwise read as *set*.
- [src/lib/download.ts](src/lib/download.ts) — `downloadBlob`. The **only** place the app hands a file to the browser.
- [src/lib/id.ts](src/lib/id.ts) — `createId()`, `crypto.randomUUID()` with a fallback.
- [src/lib/exportFormat.ts](src/lib/exportFormat.ts) — `timestampedFilename`.

## Save / reload progress

One JSON file **per course** in `progresses/`, written automatically with no prompt: "CPSC 330" → `progresses/CPSC_330.json`.

**Client — [src/lib/progressFile.ts](src/lib/progressFile.ts)**
- `courseFileName(name, taken)` — spaces → underscores, filesystem-unsafe characters stripped, **leading dots removed** (the server refuses hidden files, so a course named `..` would otherwise be dropped silently), deduped case-insensitively.
- `buildProgressFiles(courses)` / `parseProgressFiles(files)` — **pure**, one file per course and back.
- `saveProgressToServer` / `loadProgressFromServer` — `PUT`/`GET` on `/api/progress`. Throw `ProgressApiUnavailableError` when nothing is listening *or* the response isn't JSON (a static host answers the SPA fallback with HTML, so a 200 alone proves nothing).
- `buildProgressJson` / `parseProgressJson` — each file holds the same `{ version, courses }` envelope as `localStorage` with one course, so `migrate` opens old files.
- `saveProgressAsSingleFile` — the no-server fallback.

**Server — [vite-plugin-progress-files.ts](vite-plugin-progress-files.ts)**
- A Vite plugin adding `GET`/`PUT /api/progress`, attached to both the dev and preview servers. The browser can't touch the filesystem; the Node process behind it can.
- `isSafeProgressFileName` / `resolveProgressPath` — the security boundary. Filenames arrive from the page, so traversal (`../../.bashrc`) must be rejected; both a name check and a resolved-path check apply. Unicode is allowed since course titles aren't always English.
- `writeProgressFiles` makes the folder **match the payload exactly**: it writes the incoming files and prunes every other `.json`. Saving zero courses empties the folder, which is why the client has no "nothing to save" guard. Non-JSON files are never touched.

⚠️ The API only exists while a Vite server runs. `npm run build` output served elsewhere has no Node process, so the client degrades to a download and a manual file picker.

⚠️ `progresses/` is gitignored — it's personal data, not source.

## Components — `src/components/`

Presentational; state arrives as props. None read the store.

- [CourseSection.tsx](src/components/CourseSection.tsx) (133) — one course. Gates the final grade on `areWeightsValid`; owns its own `AddBreakdownDialog` instance.
- [BreakdownCard.tsx](src/components/BreakdownCard.tsx) (133) — one breakdown. Local UI state: `isOpen`, `showAdvanced`.
- [SubBreakdownRow.tsx](src/components/SubBreakdownRow.tsx) (80) — name, `achieved / full` mark inputs, and the row's own percentage.
- [AdvancedOptions.tsx](src/components/AdvancedOptions.tsx) — three switches as a **controlled field group** over a `GradingPolicy`. Drop/downweight disable each other; Full Credit deliberately does not. Holds one piece of local state, `fullCreditEnabled`, because `fullCreditGrade === null` already means "off" and so can't also mean "on, threshold not typed yet". No help tooltips — they never worked and were removed. Used by both dialogs; holds no rules of its own.
- [AdvancedOptionsDialog.tsx](src/components/AdvancedOptionsDialog.tsx) — modal wrapper with Cancel/Apply. Draft state lives in an inner component `key`ed on `open`, so it re-seeds on every open (see the comment there — two subtler approaches were both wrong).
- [NewCourseDialog.tsx](src/components/NewCourseDialog.tsx) (74) — prompts for a course name; Add disabled while blank.
- [AddBreakdownDialog.tsx](src/components/AddBreakdownDialog.tsx) — preset picker + "Others (Specify)" free text + weight + a collapsed advanced-options section, in a `<form>` so Return submits. Caps the dropdown with `max-h-56`.
- [NumberInput.tsx](src/components/NumberInput.tsx) (26) — `<Input type="number">` that blurs on wheel so scrolling can't rewrite a mark. **Use this for every numeric field.**
- [GradeDisplay.tsx](src/components/GradeDisplay.tsx) (43) — the only grade-rendering surface.
- [CourseToolbar.tsx](src/components/CourseToolbar.tsx) — header **Reload Progress** / **Save Progress** / **New Course** actions and their toasts.

## Pages & hooks

- [src/pages/Index.tsx](src/pages/Index.tsx) (114) — owns the store, header, empty state, `NewCourseDialog`, and the horizontal snap carousel.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) (24) — 404.
- [src/hooks/useProgressFile.ts](src/hooks/useProgressFile.ts) — owns both **Save Progress** and **Reload Progress**: calls the local API, falls back on `ProgressApiUnavailableError`, and reports outcomes. Holds the hidden multi-file input used by the fallback.
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

## Tests — `src/test/`, 240 across 8 files

All tests live here, one file per module, importing via `@/lib/...`:
[gradeCalculations](src/test/gradeCalculations.test.ts) · [gradePolicies](src/test/gradePolicies.test.ts) · [gradeFormatting](src/test/gradeFormatting.test.ts) · [breakdownPresets](src/test/breakdownPresets.test.ts) · [courseStorage](src/test/courseStorage.test.ts) (v1 migration) · [progressFile](src/test/progressFile.test.ts) (save/reload round trip, bad input, older files) · [useGradeStore](src/test/useGradeStore.test.ts) (hook driven via `renderHook` with in-memory storage).
[setup.ts](src/test/setup.ts) provides `jest-dom` + a `matchMedia` stub. Untested: React components (the store hook is now covered).

## Build & config

- [vite.config.ts](vite.config.ts) — port **8080**, registers `progressFilesPlugin()`, `open: true` (launches the OS default browser on `npm run dev`; `BROWSER=none` suppresses it), `@` → `./src`, `lovable-tagger` in dev only.
- [vitest.config.ts](vitest.config.ts) — jsdom, globals on.
- [.claude/launch.json](.claude/launch.json) — dev-server config for tooling.
- [tsconfig.app.json](tsconfig.app.json) — ⚠️ `strict: false`. Types are advisory.
- Lockfiles: both `bun.lock` and `package-lock.json` exist. ⚠️ Pick one.
