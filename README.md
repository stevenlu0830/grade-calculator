# Technical README — UBC Grade Calculator

> Living documentation. Update this file when architecture, data flow, or invariants change.
> Companions: [CODEBASE_INDEX.md](CODEBASE_INDEX.md) (what lives where) · [CONVENTIONS.md](CONVENTIONS.md) (how to write code here) · [UI_GUIDE.md](UI_GUIDE.md) (beginner tour of `public/` and the shadcn `ui/` folder).

## 1. What this is

A single-page, client-only calculator for UBC-style weighted course grades. A student enters courses → weighted components (e.g. "Assignments 30%") → sub-components (individual assignments), and sees component grades, weighted contributions, and a final letter grade recompute live.

**Defining characteristics:**
- **Zero backend.** No API, no auth, no telemetry, no network calls at runtime. The only external fetch is a Google Fonts stylesheet in `src/index.css`.
- **`localStorage` is the database.** One key, one JSON blob.
- **All state in one hook**, instantiated once, prop-drilled down three levels.
- Supports drop-lowest and downweight-lowest grading policies, plus CSV round-trip and PDF export.

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite 8 + `@vitejs/plugin-react-swc` | Dev server on **:8080**, HMR overlay disabled |
| Language | TypeScript 5.8 | `strict: false` — see §9 |
| UI | React 18 | No Suspense, no server components |
| Routing | react-router-dom 6 | Two routes; effectively a single page |
| Styling | Tailwind 3 + CSS variables | shadcn/ui `default` style, slate base |
| Components | shadcn/ui over Radix | 48 vendored primitives, ~11 in use |
| PDF | `jspdf` + `jspdf-autotable` | |
| Toasts | `sonner` | shadcn `use-toast` also present but unused |
| Tests | Vitest 3 + jsdom + Testing Library | 123 tests over `src/lib/*`; components untested |

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
 └── Component        weight %, optional drop/downweight policy
      └── SubComponent   name + grade 0–100 (nullable)
```

Defined in [src/types/grades.ts](src/types/grades.ts). Children carry denormalized parent IDs (`componentId`, `courseId`) — currently unused for lookups, since every mutation walks the tree by ID from the root.

The exact shape persisted to `localStorage` (a `Course[]`):

```json
[{
  "id": "k3m9x2p1q",
  "name": "CPSC 121",
  "components": [{
    "id": "a7f2n8w4c",
    "courseId": "k3m9x2p1q",
    "name": "Assignments",
    "weight": 30,
    "dropLowestCount": 1,
    "downweightLowestCount": null,
    "downweightPercent": null,
    "subComponents": [
      { "id": "z1v5b9t3r", "componentId": "a7f2n8w4c", "name": "A1", "grade": 92 },
      { "id": "y8h4j6k2l", "componentId": "a7f2n8w4c", "name": "A2", "grade": null }
    ]
  }]
}]
```

Note `"grade": null` on A2 — entered but ungraded, so it's excluded from the average entirely rather than counted as zero. There is no schema version field; a breaking change to this shape will silently corrupt existing users' saved data (§9).

**Nullability is semantic.** Every numeric field is `number | null`, where `null` = "the user hasn't entered this." A `0` is a real, meaningful zero. This distinction drives the whole UI: `null` renders as `—`, propagates through calculations, and excludes a row from averages. Preserve it — reads use `??`, never `||`.

## 5. State & persistence

[src/hooks/useGradeStore.ts](src/hooks/useGradeStore.ts) is the only stateful module.

- `useState<Course[]>` with a lazy initializer that reads through a `CourseStorage`.
- A `useEffect` on `[courses]` writes the whole array back on every change — autosave is implicit and total; no component ever calls `localStorage` itself.
- Persistence is injected, not imported: the hook takes a `CourseStorage` and defaults to `localCourseStorage`. Swapping in a server-backed or in-memory implementation touches no state logic. See [src/lib/courseStorage.ts](src/lib/courseStorage.ts).
- Storage key: `ubc-grade-calculator-data`. Read and write both degrade to console errors (private-mode and quota failures).
- IDs come from `createId()` in [src/lib/id.ts](src/lib/id.ts) — `crypto.randomUUID()`, with a `Math.random` fallback for non-DOM environments.
- Nested updates go through the module-local `mapCourse` / `mapComponent` helpers, so each action stays a few lines rather than a four-deep `.map` pyramid.

**Deliberately not a Context.** The hook is called once in `Index.tsx` and its actions are passed down as props. Calling `useGradeStore()` in a second component would create a *second independent store* whose writes race the first over the same key. If you need store access deeper in the tree, lift the call or introduce a Context — don't just call the hook again.

**Invariants enforced in the store (not the UI):**
- A component always keeps ≥1 sub-component — `deleteSubComponent` silently no-ops on the last one.
- Grades clamp to `[0, 100]` on write.
- `importCourses` replaces state wholesale; there is no merge path.

**No undo, no history.** `deleteCourse` is immediate and unrecoverable. Worth knowing before adding more destructive actions.

## 6. Grade calculation

The maths is pure and split across two modules. [gradeCalculations.ts](src/lib/gradeCalculations.ts) aggregates; [gradePolicies.ts](src/lib/gradePolicies.ts) holds the drop/downweight rules. Neither knows how a grade is displayed — that's [gradeFormatting.ts](src/lib/gradeFormatting.ts). Nothing is memoized; the tree is small and recomputes on every render.

**Component grade** (`calculateComponentGrade`), in order:
1. Collect non-null sub-component grades. None → `null`.
2. Exactly one grade → return it. **Drop and downweight are skipped for a single grade** — you can't drop your only mark.
3. Sort ascending, then dispatch on `getActiveAdvancedOption(component)`:
   - **Drop lowest N** (`applyDropLowest`) — drops `min(N, len-1)`, so at least one grade always survives even if N exceeds the count. Unweighted mean of the rest.
   - **Downweight lowest N by P%** (`applyDownweightLowest`) — the N lowest get weight `1 - P/100`, the rest weight `1`; returns the weighted mean. Returns `null` in the degenerate case where every grade is discounted to zero weight.
   - **Neither** — plain mean.
4. Drop takes precedence if both are set — `getActiveAdvancedOption` encodes that, and the UI reads the same function, so the calculator and the toggles can't disagree.

**Course grade** (`calculateCourseGrade`) sums each component's `calculateWeightedValue` across components that have *both* a grade and a weight; returns `null` if none qualify. It does **not** check that weights sum to 100 — that gate is `areWeightsValid(components)`, called by both consumers:
- [CourseSection.tsx](src/components/CourseSection.tsx) shows a warning alert and renders `—` when it fails.
- [pdfExport.ts](src/lib/pdfExport.ts) prints a warning line instead of a grade.

`areWeightsValid` compares against 100 with a `1e-9` tolerance rather than `===`. Summing decimal weights drifts: `0.01 + 64.04 + 35.95` evaluates to `100.00000000000001`, and exact equality used to hide the final grade behind a warning that read "weights total 100.0%". The tolerance absorbs float error only — `33.33 × 3 = 99.99` is a real shortfall and still warns.

**Two threshold scales coexist, intentionally:**
- Color bands (`getGradeColor`/`getGradeBg`): 90 / 80 / 70 / 60, from one `COLOUR_BANDS` table pairing text and background so they can't drift apart.
- Letter grades (`getLetterGrade`): UBC scale — A+ ≥90, A ≥85, A- ≥80, B+ ≥76, B ≥72, B- ≥68, C+ ≥64, C ≥60, C- ≥55, D ≥50, F below.

A grade of 82 therefore shows green ("good") and the letter `A-`. Don't "fix" one to match the other without asking.

### Worked example

A course with two components, drop-lowest active on the first:

| Component | Weight | Sub-component grades | Policy |
|---|---|---|---|
| Assignments | 40% | 60, 85, 90, 95 | drop lowest 1 |
| Final Exam | 60% | 78 | — |

1. **Assignments** — sorted `[60, 85, 90, 95]`; drop `min(1, 3) = 1` → `[85, 90, 95]` → mean **90.0**. Weighted contribution: `90 × 40 / 100` = **36.0**.
2. **Final Exam** — one grade, so drop/downweight are skipped → **78.0**. Contribution: `78 × 60 / 100` = **46.8**.
3. **Total weight** = `40 + 60 = 100` ✓, so `CourseSection` renders the final grade.
4. **Course grade** = `36.0 + 46.8` = **82.8** → color band "good" (≥80), letter **A-** (≥80).

Same data with *downweight lowest 1 by 50%* instead of drop, on Assignments:

- Weights `[0.5, 1, 1, 1]` against `[60, 85, 90, 95]`
- Weighted sum = `30 + 85 + 90 + 95` = `300`; total weight = `3.5` → **85.71**
- Contribution `34.29`, course grade **81.1** — still A-, but the dropped mark still drags.

Now delete the Final Exam component. Total weight becomes 40, `areWeightsValid` fails, and the final grade renders `—` even though Assignments has a perfectly valid 90. This is expected behavior, and the most common source of "the calculator is broken" reports.

## 7. UI structure & data flow

```
main.tsx → App.tsx (providers + router)
             └── pages/Index.tsx ............ owns useGradeStore, header shell, empty state, carousel
                  ├── CourseToolbar ........ import / export / new-course actions + their toasts
                  └── CourseSection ........ weight validation, final grade, course delete
                       └── ComponentCard ... weight input, component grade, collapse, advanced toggle
                            ├── SubComponentRow ... name + grade inputs
                            └── AdvancedOptions ... drop / downweight switches
```

State flows down as props; mutations flow up as `on*` callbacks, with each level closing over its own ID so children stay ID-agnostic. Nothing below `Index` knows the store exists.

CSV file handling lives in [useCsvImport](src/hooks/useCsvImport.ts) — it owns the hidden `<input type="file">`, the read, the parse and the toasts, and is a hook rather than a button so the header and the empty state can both open the same picker.

**Layout:** courses render in a horizontal scroll-snap carousel (`overflow-x-auto snap-x snap-mandatory`), each capped at `max-w-2xl`. This is a deliberate choice from commit `d3347fb`, not a wrapping grid.

**AdvancedOptions** holds no rules of its own. It reads `getActiveAdvancedOption(component)` for the current mode and calls `advancedOptionUpdate(option)` to switch, so "drop wins over downweight" and "enabling one clears the other" are defined once in `gradePolicies` and shared with the calculator. Each switch is disabled while the other is active, and `AdvancedOption` is never persisted.

## 8. Import / export

Three modules, one per responsibility: [csvExport.ts](src/lib/csvExport.ts), [csvImport.ts](src/lib/csvImport.ts), [pdfExport.ts](src/lib/pdfExport.ts). All operations are synchronous, in-browser, and never touch the network.

Each export separates **building** the artifact from **handing it to the browser**. `buildCoursesCsv(courses)` and `buildReportRows(course)` are pure and directly asserted in tests; the only DOM contact is `downloadBlob` in [download.ts](src/lib/download.ts). Before this split the CSV format could not be tested at all, because producing it required `URL.createObjectURL`.

**CSV format** — 8 columns, one row per sub-component:

```
Course Name, Component Name, Component Weight (%), Drop Lowest, Downweight Count, Downweight %, Sub-component Name, Grade
```

Parent columns are written **only on the first row of each group** and blank thereafter — a sparse, human-readable shape, applied via the shared `firstRowOnly` helper in [exportFormat.ts](src/lib/exportFormat.ts) so CSV and PDF can't diverge. `parseCSV` mirrors it by carrying the last-seen course and component forward across blank cells.

**The parser is hand-rolled** (no papaparse) and runs in three steps — `parseLine` tokenises, `resolveColumns` maps headers, then the tree is assembled. It:
- handles quoted fields and `""` escapes,
- resolves columns **by header name** with positional fallback, so reordered or extra columns survive a round-trip,
- pads short rows, clamps grades with `clampGrade`, and backfills an empty sub-component where a component would otherwise have none.

An export → import round trip is covered by tests, including names containing commas and quotes.

⚠️ **Known limitation:** the input is split on `\n` *before* quote-aware parsing, so a quoted field containing a newline breaks into multiple rows. Fine for self-exported files; a real risk for spreadsheets pasted from elsewhere. Fixing this means restructuring the tokenizer to consume the whole string — or adopting a CSV library.

Import is destructive: it replaces all existing courses with no confirmation prompt.

**PDF export** builds a per-course heading plus an autoTable, using the same first-row-only convention. The plugin ships `jsPDFDocument = any`, so its cursor position is described by a local `AutoTableDocument` interface and read with optional chaining — a narrow, documented cast instead of `as any`. A test asserts the plugin really does populate `lastAutoTable.finalY`, since a silent fallback there would make multi-course reports overlap.

## 9. Known issues & technical debt

Ordered roughly by how likely each is to bite you.

1. **`strict: false`** in [tsconfig.app.json](tsconfig.app.json), plus `noImplicitAny: false`, `strictNullChecks: false`, and unused-vars linting disabled. Given how much logic hinges on `null` vs `0` (§4), the compiler is not protecting the codebase's central invariant. Enabling `strictNullChecks` is the highest-leverage remaining cleanup — and will surface real findings.
2. **CSV newline handling** (§8) — a quoted field containing a line break tears across rows.
3. **No component test coverage.** `src/lib/*` is well covered (123 tests); every React component is untested. `AdvancedOptions` and `CourseSection` carry the most branching.
4. **Dark mode is unreachable.** Full `.dark` variable set in `index.css` and `darkMode: ["class"]` in Tailwind, but nothing ever adds the class; `next-themes` is installed and unmounted. Wiring a `ThemeProvider` is close to free.
5. **Duplicate lockfiles.** `bun.lock` and `package-lock.json` are both present, alongside a `vite` `^5.4.19 → ^8.2.0` bump. Decide on one package manager and commit the matching lockfile.
6. **Unused heavyweight deps** — react-query, recharts, react-hook-form, zod, embla — inflate the bundle without contributing. ~38 shadcn primitives are also unused, though those tree-shake.
7. **No schema version on persisted data** (§4) — a breaking change to the `Course[]` shape will silently corrupt saved data. There is no migration path.
8. **No undo and no delete confirmation** on courses or components.
9. **Prop drilling.** `CourseSectionProps` takes 9 props and forwards 6 it never uses. Deliberately left as-is: at three levels it stays readable and keeps components trivially testable. Revisit if a fourth level appears.

**Resolved in the refactor** (see §6–§8): float-equality on weight totals, the misleading "totals 100.0%" warning, `exportImport.ts` doing three jobs at once, untestable export code, grading rules duplicated between the calculator and the toggle UI, `generateId`/clamp/weighted-value duplication, `(doc as any)`, and the dead `App.css` / `NavLink.tsx` / `ui/use-toast.ts`.

## 10. Extension guide

- **New grading policy** (e.g. "best N of M"): add fields to `Component` in `types/grades.ts` → add the rule to `gradePolicies.ts` (an `applyBestOf` function, a case in `getActiveAdvancedOption`, and one in `advancedOptionUpdate`) → add a `case` in `calculateComponentGrade`'s switch → add a switch to `AdvancedOptions` → add the columns to `CSV_HEADERS` and `resolveColumns`. The switch is exhaustive over `AdvancedOption`, so TypeScript will point at every site you still need to touch.
- **New route:** add `<Route>` in `App.tsx` above the `*` catch-all, create the page in `src/pages/`.
- **Deeper store access:** convert `useGradeStore` into a Context provider rather than calling the hook twice (§5).
- **New UI primitive:** `npx shadcn@latest add <name>` — never hand-write into `src/components/ui/`.
- **New semantic color:** HSL var in both `:root` and `.dark` in `index.css`, then map it in `tailwind.config.ts`.
- **New export format:** write a pure `build…` function, then a wrapper that calls `downloadBlob` with `timestampedFilename`. Keep the wrapper too small to need a test.
- **Backend/sync, if ever:** implement the `CourseStorage` interface and pass it to `useGradeStore` — the store already depends on the interface rather than on `localStorage`. react-query is mounted and idle.

## 11. Symptom → cause map

| Symptom | Likely cause | Look in |
|---|---|---|
| Final grade shows `—` despite grades entered | Component weights genuinely don't reach 100 — the warning shows the real total | [CourseSection.tsx](src/components/CourseSection.tsx), `areWeightsValid` |
| Warning shows a total that looks like 100 | Should no longer happen — `formatWeight` keeps 2 decimals so 99.99 reads as 99.99 | [gradeFormatting.ts](src/lib/gradeFormatting.ts), `formatWeight` |
| A grade of `0` is ignored in the average | Somewhere used `||` instead of `??`, collapsing 0 to "unset" | grep for `\|\| ''` / `\|\| 0` |
| Grade entered but component still `—` | Non-numeric input never reached the store — `handleGradeChange` drops `NaN` | [SubComponentRow.tsx:19](src/components/SubComponentRow.tsx:19) |
| CSV import produces garbled/extra rows | Quoted field contained a newline (§8) | [csvImport.ts](src/lib/csvImport.ts), the `split('\n')` |
| CSV import silently loses a component | Its row had a blank Component Name, so it merged into the previous one | `parseCSV` carry-forward logic |
| Edits don't persist across reload | Storage write threw (private mode / quota) — check console | [courseStorage.ts](src/lib/courseStorage.ts) |
| Two parts of the UI disagree about state | A second `useGradeStore()` call created a rival store (§5) | grep `useGradeStore` — must appear once |
| Delete button does nothing on a sub-component | It's the last one; deletion is blocked by design | [useGradeStore.ts](src/hooks/useGradeStore.ts), `deleteSubComponent` |
| Dark styles never apply | No `ThemeProvider` mounts; `.dark` is never added (§9) | `App.tsx` |
| A policy applies in the UI but not in the grade | The two now share `getActiveAdvancedOption`; suspect a new field added to only one | [gradePolicies.ts](src/lib/gradePolicies.ts) |
| Multi-course PDF rows overlap | `lastAutoTable.finalY` came back undefined and spacing fell back | [pdfExport.ts](src/lib/pdfExport.ts), `renderCourse` |

## 12. Glossary

Terms are used consistently across code, UI, and CSV headers — keep it that way.

- **Course** — a class. Top-level container. Has a final grade only when its component weights total 100.
- **Component** — a weighted category within a course ("Assignments", "Midterm"). Carries the weight and the optional grading policy.
- **Sub-component** — one graded item inside a component ("A1", "Quiz 3"). Holds the actual 0–100 mark.
- **Weight** — a component's percentage share of the course. Sub-components are never individually weighted; they're averaged, then the component's weight applies once.
- **Component grade** — the (possibly policy-adjusted) average of a component's sub-component grades.
- **Weighted value / weighted grade** — `componentGrade × weight / 100`, i.e. the points a component contributes to the course total. Shown as "Weighted:" in `ComponentCard`.
- **Drop lowest N** — exclude the N lowest sub-component grades before averaging. Always keeps ≥1.
- **Downweight lowest N by P%** — keep the N lowest but count them at `1 - P/100` of normal weight.
- **Advanced option** — the drop/downweight choice. Derived at render time, never stored.
- **Grade band** — the 90/80/70/60 color thresholds. Distinct from the UBC letter-grade scale (§6).
