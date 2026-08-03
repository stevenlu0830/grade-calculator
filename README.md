# Technical README — UBC Grade Calculator

> Living documentation. Update this file when architecture, data flow, or invariants change.
> Companions: [CODEBASE_INDEX.md](CODEBASE_INDEX.md) (what lives where) · [CONVENTIONS.md](CONVENTIONS.md) (how to write code here) · [UI_GUIDE.md](UI_GUIDE.md) (beginner tour of `public/` and the shadcn `ui/` folder).

## 1. What this is

A single-page, client-only calculator for UBC-style weighted course grades. A student enters courses → weighted **breakdowns** (e.g. "Assignments 30%") → **sub-breakdowns** (individual assignments, each scored out of its own marks), and sees breakdown grades, weighted contributions, and a final letter grade recompute live.

**Defining characteristics:**
- **Zero backend.** No API, no auth, no telemetry, no network calls at runtime. The only external fetch is a Google Fonts stylesheet in `src/index.css`.
- **`localStorage` is the database.** One key, one JSON blob.
- **All state in one hook**, instantiated once, prop-drilled down three levels.
- **Marks-based**: a grade is total marks achieved over total marks available, so a 45/50 test outweighs a 9/10 quiz.
- Supports drop-lowest and downweight-lowest grading policies, plus CSV round-trip and PDF export.

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite 8 + `@vitejs/plugin-react-swc` | Dev server on **:8080**, HMR overlay disabled |
| Language | TypeScript 5.8 | `strict: false` — see §9 |
| UI | React 18 | No Suspense, no server components |
| Routing | react-router-dom 6 | Two routes; effectively a single page |
| Styling | Tailwind 3 + CSS variables | shadcn/ui `default` style, slate base |
| Components | shadcn/ui over Radix | 48 vendored primitives, 14 in use |
| PDF | `jspdf` + `jspdf-autotable` | |
| Toasts | `sonner` | shadcn `use-toast` also present but unused |
| Tests | Vitest 3 + jsdom + Testing Library | 163 tests in `src/test/`; React components untested |

**Present but inert:** `@tanstack/react-query` (provider mounted, no queries), `next-themes` (no provider — dark mode unreachable), `zod`, `react-hook-form`, `recharts`, `date-fns`, `embla-carousel`. Scaffolding from the Lovable template.

## 3. Running it

```sh
git clone https://github.com/stevenlu0830/grade-calculator.git
cd grade-calculator

npm i          # bun.lock is also committed — see §9
npm run dev    # http://localhost:8080
npm run build  # → dist/
npm run lint
npm test       # vitest run
```

This project was scaffolded with Lovable ([project dashboard](https://lovable.dev/projects/d0699e8b-131a-4000-8300-6958b9e4ca5b)); changes pushed to the repo and changes made there stay in sync. Editing locally, in GitHub's web editor, or in a Codespace all work.

## 4. Domain model

```
Course
 └── Breakdown          weight %, optional drop/downweight policy
      └── SubBreakdown    name + marks achieved out of full marks
```

Defined in [src/types/grades.ts](src/types/grades.ts). Children carry denormalized parent IDs (`breakdownId`, `courseId`) — currently unused for lookups, since every mutation walks the tree by ID from the root.

**A note on the vocabulary.** "Breakdown" and "sub-breakdown" are the domain terms, used identically in the code, the UI and the CSV headers. The word **"component" now means React component and nothing else** — it previously meant both, which made `Component` ambiguous in every file that imported React.

The exact shape persisted to `localStorage`:

```json
{
  "version": 2,
  "courses": [{
    "id": "8f14e45f-…",
    "name": "CPSC 121",
    "breakdowns": [{
      "id": "b1c2d3e4-…",
      "courseId": "8f14e45f-…",
      "name": "Assignments",
      "weight": 30,
      "dropLowestCount": 1,
      "downweightLowestCount": null,
      "downweightPercent": null,
      "subBreakdownLabel": "Assignment",
      "subBreakdowns": [
        { "id": "…", "breakdownId": "b1c2d3e4-…", "name": "Assignment 1", "achievedMarks": 18, "fullMarks": 20 },
        { "id": "…", "breakdownId": "b1c2d3e4-…", "name": "Assignment 2", "achievedMarks": null, "fullMarks": 25 }
      ]
    }]
  }]
}
```

Three things to notice:

- **`achievedMarks` is marks, not a percentage** — 18 out of 20, not 90. `fullMarks` defaults to 100, so a student who only knows percentages can ignore it entirely.
- **`achievedMarks: null`** on Assignment 2 means entered-but-ungraded. It's excluded from the totals rather than counted as zero, and its 25 marks don't drag the denominator either.
- **`subBreakdownLabel`** is the singular noun used to auto-name new rows ("Assignment" → "Assignment 3"). Stored rather than derived, because de-pluralising English by rule mangles Quizzes and WebWorks.

**Nullability is semantic.** `achievedMarks` and `weight` are `number | null`, where `null` = "the user hasn't entered this." A `0` is a real, meaningful zero. This distinction drives the whole UI: `null` renders as `—`, propagates through calculations, and excludes a row from totals. Preserve it — reads use `??`, never `||`. (`fullMarks` is deliberately *not* nullable; every row is out of something, defaulting to 100.)

## 5. State & persistence

[src/hooks/useGradeStore.ts](src/hooks/useGradeStore.ts) is the only stateful module.

- `useState<Course[]>` with a lazy initializer that reads through a `CourseStorage`.
- A `useEffect` on `[courses]` writes the whole array back on every change — autosave is implicit and total; no component ever calls `localStorage` itself.
- Persistence is injected, not imported: the hook takes a `CourseStorage` and defaults to `localCourseStorage`. Swapping in a server-backed or in-memory implementation touches no state logic. See [src/lib/courseStorage.ts](src/lib/courseStorage.ts).
- Storage key: `ubc-grade-calculator-data`, written as `{ version, courses }` with `SCHEMA_VERSION = 2`. Read and write both degrade to console errors (private-mode and quota failures).
- **Migration.** `migrate(raw)` in `courseStorage.ts` accepts either the current envelope or bare version-1 data (a `Course[]` using `components`/`subComponents`, where `grade` was a percentage). v1 rows are given `fullMarks: 100`, which makes them calculate to exactly the grade they did before; ids are preserved so nothing re-keys. Covered by [courseStorage.test.ts](src/test/courseStorage.test.ts).
- IDs come from `createId()` in [src/lib/id.ts](src/lib/id.ts) — `crypto.randomUUID()`, with a `Math.random` fallback for non-DOM environments.
- Nested updates go through the module-local `mapCourse` / `mapBreakdown` helpers, so each action stays a few lines rather than a four-deep `.map` pyramid.

**Deliberately not a Context.** The hook is called once in `Index.tsx` and its actions are passed down as props. Calling `useGradeStore()` in a second component would create a *second independent store* whose writes race the first over the same key. If you need store access deeper in the tree, lift the call or introduce a Context — don't just call the hook again.

**Invariants enforced in the store (not the UI):**
- A breakdown always keeps ≥1 sub-breakdown — `deleteSubBreakdown` silently no-ops on the last one.
- Marks clamp to `[0, fullMarks]` on write, and **lowering `fullMarks` re-clamps `achievedMarks` with it** — a 90/100 that becomes "out of 50" lands on 50/50, not an impossible 90/50.
- New breakdowns arrive with one auto-named sub-breakdown.
- `importCourses` replaces state wholesale; there is no merge path.

**No undo, no history.** `deleteCourse` is immediate and unrecoverable. Worth knowing before adding more destructive actions.

## 6. Grade calculation

The maths is pure and split across two modules. [gradeCalculations.ts](src/lib/gradeCalculations.ts) aggregates; [gradePolicies.ts](src/lib/gradePolicies.ts) holds the drop/downweight rules. Neither knows how a grade is displayed — that's [gradeFormatting.ts](src/lib/gradeFormatting.ts). Nothing is memoized; the tree is small and recomputes on every render.

**The model is total marks, not average percentages.** A breakdown's grade is the sum of marks achieved over the sum of marks available. A 45/50 test therefore counts for five times as much as a 9/10 quiz, instead of both being averaged as 90%. This is what most real syllabi mean by "Assignments 30%".

**Breakdown grade** (`calculateBreakdownGrade`), in order:
1. Collect scored rows via `getEnteredMarks` — ungraded rows are skipped, and so are rows worth 0 marks (nothing to divide by). None left → `null`.
2. Exactly one score → return its percentage. **Drop and downweight are skipped for a single score** — you can't drop your only mark.
3. Sort worst-first **by percentage** (`sortByPercentage`), then dispatch on `getActiveAdvancedOption(breakdown)`:
   - **Drop lowest N** (`applyDropLowest`) — drops `min(N, len-1)` worst rows. A dropped row's `fullMarks` leaves the denominator too, so dropping a 0/20 genuinely removes those 20 marks. At least one row always survives.
   - **Downweight lowest N by P%** (`applyDownweightLowest`) — scales the N worst rows' marks *and* their full marks by `1 - P/100`, so the row shrinks rather than distorting the ratio. Returns `null` if every row is discounted to zero weight.
   - **Neither** — the plain total.
4. Drop takes precedence if both are set — `getActiveAdvancedOption` encodes that, and the UI reads the same function, so the calculator and the toggles can't disagree.

Ranking is by percentage, not by raw marks lost: a 4/10 is dropped ahead of a 15/20, even though the 15/20 shed more marks. Tests pin this down.

**Backward compatibility.** When every row is out of 100, total-marks arithmetic reduces *exactly* to the old average — including under both policies. That's why migrated v1 data (§5) keeps the grade it always had, and there are tests asserting each of the three paths reduces correctly.

**Course grade** (`calculateCourseGrade`) sums each breakdown's `calculateWeightedValue` across breakdowns that have *both* a grade and a weight; returns `null` if none qualify. It does **not** check that weights sum to 100 — that gate is `areWeightsValid(breakdowns)`, called by both consumers:
- [CourseSection.tsx](src/components/CourseSection.tsx) shows a warning alert and renders `—` when it fails.
- [pdfExport.ts](src/lib/pdfExport.ts) prints a warning line instead of a grade.

`areWeightsValid` compares against 100 with a `1e-9` tolerance rather than `===`. Summing decimal weights drifts: `0.01 + 64.04 + 35.95` evaluates to `100.00000000000001`, and exact equality used to hide the final grade behind a warning that read "weights total 100.0%". The tolerance absorbs float error only — `33.33 × 3 = 99.99` is a real shortfall and still warns.

**Two threshold scales coexist, intentionally:**
- Color bands (`getGradeColor`/`getGradeBg`): 90 / 80 / 70 / 60, from one `COLOUR_BANDS` table pairing text and background so they can't drift apart.
- Letter grades (`getLetterGrade`): UBC scale — A+ ≥90, A ≥85, A- ≥80, B+ ≥76, B ≥72, B- ≥68, C+ ≥64, C ≥60, C- ≥55, D ≥50, F below.

A grade of 82 therefore shows green ("good") and the letter `A-`. Don't "fix" one to match the other without asking.

### Worked example

A course with two breakdowns, where the assignments are worth different numbers of marks:

| Breakdown | Weight | Sub-breakdown marks | Policy |
|---|---|---|---|
| Assignments | 40% | 4/10, 18/20, 10/10 | — |
| Final Exam | 60% | 78/100 | — |

1. **Assignments** — `(4 + 18 + 10) / (10 + 20 + 10)` = `32/40` = **80.0%**. Contribution: `80 × 40 / 100` = **32.0**.
   - Averaging the percentages instead would give `(40 + 90 + 100) / 3` = **76.7%** — a different, wrong answer. The 20-mark assignment deserves double the pull of a 10-mark one.
2. **Final Exam** — one score → **78.0%**. Contribution: `78 × 60 / 100` = **46.8**.
3. **Total weight** = `40 + 60 = 100` ✓, so `CourseSection` renders the final grade.
4. **Course grade** = `32.0 + 46.8` = **78.8** → colour band "average" (≥70), letter **B+** (≥76).

Now switch *drop lowest 1* on for Assignments:

- Ranked by percentage: `4/10` (40%), `18/20` (90%), `10/10` (100%). The 4/10 goes.
- Remaining: `(18 + 10) / (20 + 10)` = `28/30` = **93.3%** — note the dropped row's 10 marks left the denominator too.
- Contribution `37.3`, course grade **84.1** → **A-**.

And with *downweight lowest 1 by 50%* instead:

- The 4/10 becomes `2/5`; the rest are untouched.
- `(2 + 18 + 10) / (5 + 20 + 10)` = `30/35` = **85.7%**, contribution `34.3`, course grade **81.1**.

Finally, delete the Final Exam breakdown. Total weight becomes 40, `areWeightsValid` fails, and the final grade renders `—` even though Assignments has a perfectly valid 80. This is expected behaviour, and the most common source of "the calculator is broken" reports — the warning shows the real total so it's diagnosable.

## 7. UI structure & data flow

```
main.tsx → App.tsx (providers + router)
             └── pages/Index.tsx ............ owns useGradeStore, header shell, empty state, carousel
                  ├── NewCourseDialog ...... prompts for a course name
                  ├── CourseToolbar ........ import / export / new-course actions + their toasts
                  └── CourseSection ........ weight validation, final grade, course delete
                       ├── AddBreakdownDialog .. preset picker + weight (one instance per course)
                       └── BreakdownCard ....... weight input, breakdown grade, collapse, advanced toggle
                            ├── SubBreakdownRow ... name + achieved/full mark inputs
                            └── AdvancedOptions ... drop / downweight switches
```

State flows down as props; mutations flow up as `on*` callbacks, with each level closing over its own ID so children stay ID-agnostic. Nothing below `Index` knows the store exists.

**Creation goes through dialogs.** `New Course` and `Add Breakdown` no longer create a blank row inline — each opens a centred modal and only commits on submit, with the confirm button disabled until the form is valid. `AddBreakdownDialog` is rendered *inside* `CourseSection`, so each course owns its own instance and there's no question which course a submission belongs to. Its options come from `BREAKDOWN_PRESETS`; picking "Others (Specify)" reveals a free-text name field.

**Numeric inputs go through [NumberInput](src/components/NumberInput.tsx)**, never raw `<Input type="number">`. Browsers step a focused number input on wheel events, so scrolling the page over a field would silently rewrite a mark; `NumberInput` blurs on wheel instead, and `index.css` hides the spinner arrows. Use it for every new numeric field.

CSV file handling lives in [useCsvImport](src/hooks/useCsvImport.ts) — it owns the hidden `<input type="file">`, the read, the parse and the toasts, and is a hook rather than a button so the header and the empty state can both open the same picker.

**Layout:** courses render in a horizontal scroll-snap carousel (`overflow-x-auto snap-x snap-mandatory`), each capped at `max-w-2xl`. This is a deliberate choice from commit `d3347fb`, not a wrapping grid.

**AdvancedOptions** holds no rules of its own. It reads `getActiveAdvancedOption(breakdown)` for the current mode and calls `advancedOptionUpdate(option)` to switch, so "drop wins over downweight" and "enabling one clears the other" are defined once in `gradePolicies` and shared with the calculator. Each switch is disabled while the other is active, and `AdvancedOption` is never persisted.

## 8. Import / export

Three modules, one per responsibility: [csvExport.ts](src/lib/csvExport.ts), [csvImport.ts](src/lib/csvImport.ts), [pdfExport.ts](src/lib/pdfExport.ts). All operations are synchronous, in-browser, and never touch the network.

Each export separates **building** the artifact from **handing it to the browser**. `buildCoursesCsv(courses)` and `buildReportRows(course)` are pure and directly asserted in tests; the only DOM contact is `downloadBlob` in [download.ts](src/lib/download.ts). Before this split the CSV format could not be tested at all, because producing it required `URL.createObjectURL`.

**CSV format** — 9 columns, one row per sub-breakdown:

```
Course Name, Breakdown Name, Breakdown Weight (%), Drop Lowest, Downweight Count, Downweight %,
Sub-breakdown Name, Marks Achieved, Full Marks
```

Parent columns are written **only on the first row of each group** and blank thereafter — a sparse, human-readable shape, applied via the shared `firstRowOnly` helper in [exportFormat.ts](src/lib/exportFormat.ts) so CSV and PDF can't diverge. `parseCSV` mirrors it by carrying the last-seen course and breakdown forward across blank cells.

**The parser is hand-rolled** (no papaparse) and runs in three steps — `parseLine` tokenises, `resolveColumns` maps headers, then the tree is assembled. It:
- handles quoted fields and `""` escapes,
- resolves each column against its current **and** legacy header name via `COLUMN_ALIASES`, so CSVs exported before the breakdown rename still import — a missing `Full Marks` column defaults to 100, which is what those percentages already meant,
- pads short rows, clamps marks with `clampAchievedMarks`, and backfills an auto-named sub-breakdown where a breakdown would otherwise have none.

An export → import round trip is covered by tests, including names containing commas and quotes.

⚠️ **Known limitation:** the input is split on `\n` *before* quote-aware parsing, so a quoted field containing a newline breaks into multiple rows. Fine for self-exported files; a real risk for spreadsheets pasted from elsewhere. Fixing this means restructuring the tokenizer to consume the whole string — or adopting a CSV library.

Import is destructive: it replaces all existing courses with no confirmation prompt.

**PDF export** builds a per-course heading plus an autoTable, using the same first-row-only convention. The plugin ships `jsPDFDocument = any`, so its cursor position is described by a local `AutoTableDocument` interface and read with optional chaining — a narrow, documented cast instead of `as any`. A test asserts the plugin really does populate `lastAutoTable.finalY`, since a silent fallback there would make multi-course reports overlap.

## 9. Known issues & technical debt

Ordered roughly by how likely each is to bite you.

1. **`strict: false`** in [tsconfig.app.json](tsconfig.app.json), plus `noImplicitAny: false`, `strictNullChecks: false`, and unused-vars linting disabled. Given how much logic hinges on `null` vs `0` (§4), the compiler is not protecting the codebase's central invariant. Enabling `strictNullChecks` is the highest-leverage remaining cleanup — and will surface real findings.
2. **CSV newline handling** (§8) — a quoted field containing a line break tears across rows.
3. **No component test coverage.** `src/lib/*` is well covered (163 tests); every React component is untested. The two dialogs and `AdvancedOptions` carry the most branching, and the dialogs' validation rules are currently only verified by hand.
4. **Dark mode is unreachable.** Full `.dark` variable set in `index.css` and `darkMode: ["class"]` in Tailwind, but nothing ever adds the class; `next-themes` is installed and unmounted. Wiring a `ThemeProvider` is close to free.
5. **Duplicate lockfiles.** `bun.lock` and `package-lock.json` are both present, alongside a `vite` `^5.4.19 → ^8.2.0` bump. Decide on one package manager and commit the matching lockfile.
6. **Unused heavyweight deps** — react-query, recharts, react-hook-form, zod, embla — inflate the bundle without contributing. 30 shadcn primitives are also unused, though those tree-shake.
7. **`fullMarks: 0` is representable.** The UI lets a row be worth zero marks; the calculator skips such rows rather than dividing by zero, but nothing stops a student typing it and wondering why the row is ignored.
8. **No undo and no delete confirmation** on courses or breakdowns.
9. **Prop drilling.** `CourseSectionProps` takes 9 props and forwards 6 it never uses. Deliberately left as-is: at three levels it stays readable and keeps components trivially testable. Revisit if a fourth level appears.

**Resolved along the way:** float-equality on weight totals; the misleading "totals 100.0%" warning; `exportImport.ts` doing three jobs at once; untestable export code; grading rules duplicated between the calculator and the toggle UI; `generateId`/clamp/weighted-value duplication; `(doc as any)`; the dead `App.css` / `NavLink.tsx` / `ui/use-toast.ts`; and the missing schema version, now handled by the versioned envelope and `migrate` (§5).

## 10. Extension guide

- **New grading policy** (e.g. "best N of M"): add fields to `Breakdown` in `types/grades.ts` → add the rule to `gradePolicies.ts` (an `applyBestOf` over `MarkPair[]`, a case in `getActiveAdvancedOption`, and one in `advancedOptionUpdate`) → add a `case` in `calculateBreakdownGrade`'s switch → add a switch to `AdvancedOptions` → add the columns to `CSV_HEADERS` and `COLUMN_ALIASES`. The switch is exhaustive over `AdvancedOption`, so TypeScript will point at every site you still need to touch.
- **New breakdown type:** add an entry to `BREAKDOWN_PRESETS` in `breakdownPresets.ts` with its `singular`. The dialog and the CSV importer both read from there, so that's the only edit.
- **Changing the persisted shape:** bump `SCHEMA_VERSION`, extend `migrate` in `courseStorage.ts`, and add a test asserting old data still calculates the same. Saved data is the one thing here that can't be regenerated.
- **New route:** add `<Route>` in `App.tsx` above the `*` catch-all, create the page in `src/pages/`.
- **Deeper store access:** convert `useGradeStore` into a Context provider rather than calling the hook twice (§5).
- **New UI primitive:** `npx shadcn@latest add <name>` — never hand-write into `src/components/ui/`.
- **New semantic color:** HSL var in both `:root` and `.dark` in `index.css`, then map it in `tailwind.config.ts`.
- **New export format:** write a pure `build…` function, then a wrapper that calls `downloadBlob` with `timestampedFilename`. Keep the wrapper too small to need a test.
- **Backend/sync, if ever:** implement the `CourseStorage` interface and pass it to `useGradeStore` — the store already depends on the interface rather than on `localStorage`. react-query is mounted and idle.

## 11. Symptom → cause map

| Symptom | Likely cause | Look in |
|---|---|---|
| Final grade shows `—` despite marks entered | Breakdown weights genuinely don't reach 100 — the warning shows the real total | [CourseSection.tsx](src/components/CourseSection.tsx), `areWeightsValid` |
| Breakdown grade isn't the average of the row percentages | Working as designed — it's total marks over total available (§6). A 45/50 outweighs a 9/10 | `totalPercentage` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| A row shows a percentage but doesn't affect the grade | Its `fullMarks` is 0, so `getEnteredMarks` skips it | [gradeCalculations.ts](src/lib/gradeCalculations.ts), `getEnteredMarks` |
| Marks silently dropped when lowering "out of" | By design — `achievedMarks` re-clamps to the new `fullMarks` | [useGradeStore.ts](src/hooks/useGradeStore.ts), `applySubBreakdownUpdate` |
| Scrolling the page changed a mark | A raw `<Input type="number">` slipped in instead of `NumberInput` | grep for `type="number"` outside [NumberInput.tsx](src/components/NumberInput.tsx) |
| A mark of `0` is ignored | Somewhere used `||` instead of `??`, collapsing 0 to "unset" | grep for `\|\| ''` / `\|\| 0` |
| Marks typed but breakdown still `—` | Non-numeric input never reached the store — `handleAchievedChange` drops `NaN` | [SubBreakdownRow.tsx](src/components/SubBreakdownRow.tsx) |
| Wrong row got dropped by "drop lowest" | Ranking is by percentage, not raw marks lost (§6) | `sortByPercentage` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| Old saved data vanished after an update | `migrate` didn't recognise the shape — check the console and the `version` field | [courseStorage.ts](src/lib/courseStorage.ts), `migrate` |
| CSV import produces garbled/extra rows | Quoted field contained a newline (§8) | [csvImport.ts](src/lib/csvImport.ts), the `split('\n')` |
| CSV import silently loses a breakdown | Its row had a blank Breakdown Name, so it merged into the previous one | `parseCSV` carry-forward logic |
| Old CSV imports with everything out of 100 | Correct — legacy files have no `Full Marks` column, so it defaults to 100 | `COLUMN_ALIASES` in [csvImport.ts](src/lib/csvImport.ts) |
| Breakdown added to the wrong course | Each `CourseSection` owns its own `AddBreakdownDialog`; suspect one hoisted to a shared parent | [CourseSection.tsx](src/components/CourseSection.tsx) |
| New sub-breakdown name duplicates an existing one | `nextSubBreakdownName` continues past the highest number used; a renamed row won't match the pattern | [breakdownPresets.ts](src/lib/breakdownPresets.ts) |
| Two parts of the UI disagree about state | A second `useGradeStore()` call created a rival store (§5) | grep `useGradeStore` — must appear once |
| Delete does nothing on a sub-breakdown | It's the last one; deletion is blocked by design | [useGradeStore.ts](src/hooks/useGradeStore.ts), `deleteSubBreakdown` |
| Dark styles never apply | No `ThemeProvider` mounts; `.dark` is never added (§9) | `App.tsx` |
| Multi-course PDF rows overlap | `lastAutoTable.finalY` came back undefined and spacing fell back | [pdfExport.ts](src/lib/pdfExport.ts), `renderCourse` |

## 12. Glossary

Terms are used consistently across code, UI, and CSV headers — keep it that way.

- **Course** — a class. Top-level container. Has a final grade only when its breakdown weights total 100.
- **Breakdown** — a weighted category within a course ("Assignments", "Final Exam"). Carries the weight and the optional grading policy. Formerly called a "component"; that word now means React component only.
- **Sub-breakdown** — one graded item inside a breakdown ("Assignment 1", "Quiz 3"). Holds the marks achieved and the marks available.
- **Marks achieved** (`achievedMarks`) — what the student scored, in marks. `null` until entered.
- **Full marks** (`fullMarks`) — what the item was out of. Defaults to 100, so percentages still work unchanged.
- **Weight** — a breakdown's percentage share of the course. Sub-breakdowns are never individually weighted; their marks are totalled, then the breakdown's weight applies once.
- **Breakdown grade** — total marks achieved over total marks available within a breakdown, as a percentage, after any policy adjustment. *Not* an average of the row percentages.
- **Weighted value / weighted grade** — `breakdownGrade × weight / 100`, i.e. the points a breakdown contributes to the course total. Shown as "Weighted:" in `BreakdownCard`.
- **Drop lowest N** — exclude the N worst-scoring sub-breakdowns, ranked by percentage. Their full marks leave the total too. Always keeps ≥1.
- **Downweight lowest N by P%** — scale the N worst-scoring sub-breakdowns' marks *and* full marks by `1 - P/100`.
- **Advanced option** — the drop/downweight choice. Derived from field nullability at render time, never stored.
- **Sub-breakdown label** (`subBreakdownLabel`) — the singular noun used to auto-name rows ("Assignment" → "Assignment 3").
- **Grade band** — the 90/80/70/60 colour thresholds. Distinct from the UBC letter-grade scale (§6).
