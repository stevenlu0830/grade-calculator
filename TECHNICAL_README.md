# Technical README — UBC Grade Calculator

> Living documentation. Update this file when architecture, data flow, or invariants change.
> Companions: [README.md](README.md) (how to use the app, for students) · [CODEBASE_INDEX.md](CODEBASE_INDEX.md) (what lives where) · [CONVENTIONS.md](CONVENTIONS.md) (how to write code here) · [UI_GUIDE.md](UI_GUIDE.md) (beginner tour of `public/` and the shadcn `ui/` folder).

## 1. What this is

A single-page, client-only calculator for UBC-style weighted course grades. A student enters **semesters** → courses → weighted **breakdowns** (e.g. "Assignments 30%") → **sub-breakdowns** (individual assignments, each scored out of its own marks), and sees breakdown grades, weighted contributions, and a final letter grade recompute live.

**Defining characteristics:**
- **Accounts, via Supabase.** Sign-in is required; each student's grades live in their own row and are guarded by row-level security (§5a). Telemetry and third-party calls remain zero. A local `/api/progress` route served by the Vite dev server still lets Save/Reload touch `progresses/` on disk (§8) — it doesn't exist in a static build. The only other external fetch is a Google Fonts stylesheet in `src/index.css`.
- **One JSON document per user.** Supabase stores the whole `{ courses, semesters }` tree in a single `jsonb` column, in exactly the shape `localStorage` used to hold — so one `migrate` serves both.
- **All state in one hook**, instantiated once, prop-drilled down three levels.
- **Marks-based**: a grade is total marks achieved over total marks available, so a 45/50 test outweighs a 9/10 quiz — unless a breakdown opts into equal weighting, which is the one way to get an average of percentages.
- **Grouped by semester**, chosen from a year and one of UBC's four terms.
- Supports drop-lowest, downweight-lowest, equal-weight and full-credit-threshold grading policies, plus saving each course to its own JSON file in a `progresses/` folder.

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite 8 + `@vitejs/plugin-react-swc` | Dev server on **:8080**, HMR overlay disabled |
| Language | TypeScript 5.8 | `strict: false` — see §9 |
| UI | React 18 | No Suspense, no server components |
| Routing | react-router-dom 6 | Two routes; effectively a single page |
| Styling | Tailwind 3 + CSS variables | shadcn/ui `default` style, slate base; tokens are hex, bridged by `token()` (§7) |
| Components | shadcn/ui over Radix | 48 vendored primitives, 13 in use |
| Toasts | `sonner` | shadcn `use-toast` also present but unused |
| Auth & data | Supabase (`@supabase/supabase-js` 2) | Email + password; one `jsonb` row per user, guarded by RLS (§5a) |
| Tests | Vitest 3 + jsdom + Testing Library | 450 tests in `src/test/`; React components untested |

**Present but inert:** `@tanstack/react-query` (provider mounted, no queries), `next-themes` (no provider — dark mode unreachable), `zod`, `react-hook-form`, `recharts`, `date-fns`, `embla-carousel`. Scaffolding from the Lovable template. `jspdf`/`jspdf-autotable` are now unused too, since PDF export was removed — still in `package.json`, no longer in the bundle.

## 3. Running it

```sh
git clone https://github.com/stevenlu0830/grade-calculator.git
cd grade-calculator

npm i          # bun.lock is also committed — see §9
npm run dev    # http://localhost:8080 — opens your default browser automatically
npm run build  # → dist/
npm run lint
npm test       # vitest run
```

⚠️ `npm i` fails with `ERESOLVE` on a clean checkout: `@vitejs/plugin-react-swc` declares a peer of `vite ^4 || ^5 || ^6 || ^7` and this project runs vite 8. Use `npm i --legacy-peer-deps` until the plugin is updated.

**Supabase setup — the app won't run without it.** Sign-in is required, so a checkout with no project configured shows a setup screen instead of the login form. Once:

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. In the dashboard's **SQL Editor**, paste and run [supabase/migrations/0001_user_data.sql](supabase/migrations/0001_user_data.sql). This creates the `user_data` table and its RLS policies.
3. Copy `.env.example` to `.env.local` and fill in **Project Settings → API**:
   ```sh
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart the dev server. Vite reads env files at startup.

While developing, turn **Authentication → Sign In / Providers → Confirm email** *off* so registering signs you straight in. With it on, Supabase's built-in mailer is rate-limited to a handful of messages an hour — fine for you and a few friends, but a real deployment wants custom SMTP.

`.env.local` is gitignored by the existing `*.local` rule. Both values are safe in the browser regardless: the anon key is publishable, and RLS is what actually separates accounts (§5a).

`npm run dev` opens the OS default browser via Vite's `server.open`. Set `BROWSER=none npm run dev` to suppress it — useful in CI, or when an editor preview is already attached.

This project was scaffolded with Lovable ([project dashboard](https://lovable.dev/projects/d0699e8b-131a-4000-8300-6958b9e4ca5b)); changes pushed to the repo and changes made there stay in sync. Editing locally, in GitHub's web editor, or in a Codespace all work.

## 4. Domain model

```
Semester                 a label like "2026 Summer Term 2"
 └── Course              belongs to exactly one semester
      └── Breakdown      weight %, optional grading policy (drop / downweight / equal weight / full credit / bonus)
           └── SubBreakdown   name + marks achieved out of full marks
```

Defined in [src/types/grades.ts](src/types/grades.ts). Children carry denormalized parent IDs (`breakdownId`, `courseId`) — currently unused for lookups, since every mutation walks the tree by ID from the root.

**A note on the vocabulary.** "Breakdown" and "sub-breakdown" are the domain terms, used identically in the code, the UI and the saved files. The word **"component" now means React component and nothing else** — it previously meant both, which made `Component` ambiguous in every file that imported React.

The exact shape persisted to `localStorage`:

```json
{
  "version": 6,
  "semesters": ["2026 Summer Term 2"],
  "courses": [{
    "id": "8f14e45f-…",
    "name": "CPSC 121",
    "semester": "2026 Summer Term 2",
    "breakdowns": [{
      "id": "b1c2d3e4-…",
      "courseId": "8f14e45f-…",
      "name": "Assignments",
      "weight": 30,
      "dropLowestCount": 1,
      "downweightLowestCount": null,
      "downweightPercent": null,
      "fullCreditGrade": null,
      "isBonus": false,
      "equalWeightSubBreakdowns": false,
      "subBreakdownLabel": "Assignment",
      "subBreakdowns": [
        { "id": "…", "breakdownId": "b1c2d3e4-…", "name": "Assignment 1", "achievedMarks": 18, "fullMarks": 20 },
        { "id": "…", "breakdownId": "b1c2d3e4-…", "name": "Assignment 2", "achievedMarks": null, "fullMarks": 25 }
      ]
    }]
  }]
}
```

Things to notice:

- **`semesters`** is the list of semesters that exist, stored alongside the courses so one with no courses in it survives a reload. See §4a.
- **`semester`** groups courses. A course belongs to exactly one; `''` means unassigned. See §4a.
- **The order of `courses` is meaningful.** It's the order they're shown in, and it's preserved across a save and reload. See §8.
- **`achievedMarks` is marks, not a percentage** — 18 out of 20, not 90.
- **Both mark fields start blank.** `fullMarks` is `number | null`; a row with no full marks yet can't produce a score, so it's excluded from the totals until filled in. (Legacy data is the exception — see §5.)
- **`achievedMarks: null`** on Assignment 2 means entered-but-ungraded. It's excluded from the totals rather than counted as zero, and its 25 marks don't drag the denominator either.
- **Marks are never corrected.** A score above full marks is a valid bonus and pushes the breakdown past 100%; nothing is clamped on entry, on import, or when full marks change.
- **`fullCreditGrade`** is the percentage that earns 100% for the breakdown, or `null`. Unlike drop/downweight it is *not* part of the mutually-exclusive pair — see §6.
- **`isBonus`** makes the breakdown extra credit: its weight is added on top of the course rather than counted towards the 100% — see §6.
- **`equalWeightSubBreakdowns`** makes every row count the same regardless of what it was marked out of. It's the one opt-out from the marks model, for a syllabus that says "each assignment is worth 5%" while marking them out of different totals — see §6.
- **`subBreakdownLabel`** is the singular noun used to auto-name new rows ("Assignment" → "Assignment 3"). Stored rather than derived, because de-pluralising English by rule mangles Quizzes and WebWorks.

**Nullability is semantic.** `achievedMarks`, `fullMarks` and `weight` are all `number | null`, where `null` = "the user hasn't entered this." A `0` is a real, meaningful zero. This distinction drives the whole UI: `null` renders as `—`, propagates through calculations, and excludes a row from totals. Preserve it — reads use `??`, never `||`.

### 4a. Semesters

Courses are grouped by semester, chosen from a year and one of UBC's four terms, and stored on the course as a label: `"semester": "2026 Summer Term 2"`.

**Semesters are stored twice over, on purpose.** Each course names its own, *and* the envelope carries an explicit `semesters` list. The list is what anchors a semester with no courses in it; without it, an empty semester would have nothing to be reconstructed from. [semesters.ts](src/lib/semesters.ts) reconciles the two, and `TERMS` is ordered *chronologically within an academic year* — Winter Term 1 starts in September, so it precedes the Summer terms.

- `visibleSemesters(courses, semesters)` — what the panel shows: the union, so a semester survives whether it's on the list, named by a course, or both.
- `persistedSemesters(courses, semesters)` — what gets stored: the same union, minus the unassigned bucket. The store applies it on load and on import, so data saved before the list existed (v4 and earlier) heals into it rather than losing a semester the first time its last course is deleted.

Consequences:

- **Courses saved before semesters existed** normalize to `''` and appear under **Unassigned**, sorted last, rather than vanishing from the panel. The unassigned bucket is never persisted to the list — it isn't a semester anyone created, so it disappears once nothing is in it.
- **Deleting a semester deletes its courses.** `deleteSemester` drops the label *and* every course under it, which is why its confirmation names the count and says it can't be undone before anything happens.

**Adding a course requires a selected semester** — the course has to belong to one. `New Course` reports "Add a semester first" rather than opening the dialog when none is selected. `addCourse` also records the semester on the list, so a semester loaded from a file that never named it explicitly still becomes anchored.

**The panel abbreviates.** `shortSemesterLabel` renders `"2023 Winter Term 1"` as `2023W1`, because the full label was wide enough to be truncated to "2023 Winter Te…", which identified nothing. Hovering a row gives the full label and the course count back via a tooltip, and the button's `aria-label` carries it for screen readers. It is display-only — nothing parses it, nothing stores it, and every other surface (the delete confirmation, the empty state, the new-course dialog) shows the full label.

## 5. State & persistence

[src/hooks/useGradeStore.ts](src/hooks/useGradeStore.ts) is the only stateful module.

- `useState<GradeData>` — `{ courses, semesters }` — starting empty and replaced by an **async** load in an effect. `isLoading` is true until it lands, and nothing renders the courses before then, so the placeholder is never mistaken for "no courses yet".
- A `useEffect` on `[data]` writes the whole object back on every change — autosave is implicit and total; no component ever calls storage itself.
- Persistence is injected, not imported: the hook takes a `CourseStorage` and defaults to `localCourseStorage`. See [src/lib/courseStorage.ts](src/lib/courseStorage.ts).
- Local storage key: `ubc-grade-calculator-data`, written as `{ version, courses, semesters }` with `SCHEMA_VERSION = 6`. Read and write both degrade to console errors (private-mode and quota failures). Supabase writes the same envelope into a `jsonb` column (§5a).

**Three rules keep an async backend from losing data:**

1. **The store never saves what it just loaded.** A `persisted` ref holds the exact object storage last handed over; the save effect compares by reference and bails. Every action builds a new object, so anything that isn't that one is a genuine edit. Without this, opening the app would immediately push identical data back over the network.
2. **A failed read blocks all writes.** If `load()` rejects, `loadError` is set and the save effect returns early — the store is empty at that point, and saving on top of it would turn a network blip into a wiped account. `Index` renders an error screen with a retry rather than an editable, empty app.
3. **`storage` must have a stable identity.** It's an effect dependency, so a freshly built object each render would reload in a loop. [useAccountStorage](src/hooks/useAccountStorage.ts) caches it in a ref keyed on the user id — a ref, not `useMemo`, because only a ref actually guarantees it. Changing user swaps the storage, which is exactly what makes the store reload.

Save failures surface too: `saveError` is returned from the store and `Index` toasts it. The edit stays on screen — it's unsaved, not undone.
- **Migration.** `migrate(raw)` in `courseStorage.ts` accepts either the current envelope or bare version-1 data (a `Course[]` using `components`/`subComponents`, where `grade` was a percentage). v1 rows are given `LEGACY_FULL_MARKS` (100), which makes them calculate to exactly the grade they did before; ids are preserved so nothing re-keys. New rows created today start blank instead. A second pass, `normalizeCourses`, backfills fields added after a save — `fullCreditGrade` and `fullMarks` become `null` rather than `undefined`, since `undefined !== null` would make every later nullability check read a missing field as *set*, and `isBonus` / `equalWeightSubBreakdowns` become `false`, since everything saved before those existed counted towards the 100% and was totalled by marks. `migrate` returns `{ courses, semesters }`; anything older than version 5 has no semester list, which the store then rebuilds from the courses (§4a). Covered by [courseStorage.test.ts](src/test/courseStorage.test.ts).
- IDs come from `createId()` in [src/lib/id.ts](src/lib/id.ts) — `crypto.randomUUID()`, with a `Math.random` fallback for non-DOM environments.
- Nested updates go through the module-local `mapCourse` / `mapBreakdown` helpers, so each action stays a few lines rather than a four-deep `.map` pyramid.

**Deliberately not a Context.** The hook is called once in `Index.tsx` and its actions are passed down as props. Calling `useGradeStore()` in a second component would create a *second independent store* whose writes race the first over the same key. If you need store access deeper in the tree, lift the call or introduce a Context — don't just call the hook again.

**Invariants enforced in the store (not the UI):**
- A breakdown always keeps ≥1 sub-breakdown — `deleteSubBreakdown` silently no-ops on the last one.
- **Marks are stored verbatim.** There is no clamping on write: a 22/20 stays 22/20, and lowering full marks does not rewrite the score. Silently correcting a student's entry was worse than showing them a number over 100%.
- New breakdowns arrive with one auto-named sub-breakdown, both mark fields blank.
- `importData` replaces courses *and* semesters wholesale; there is no merge path.
- Every semester a course names is also on the semester list, applied on load and on import, so nothing visible is lost when a course is deleted.

**No undo, no history.** Every delete is immediate and unrecoverable, and they cascade — a semester takes its courses, a course takes its breakdowns, a breakdown takes its marks. That's why all four go through `ConfirmDeleteDialog` (§7), which is the only thing standing between a misclick and lost data. Keep that true for anything destructive you add.

### 5a. Accounts & sync

Sign-in is required. [App.tsx](src/App.tsx) is a gate: no Supabase config → setup notice; session still loading → spinner; no session → the login page; otherwise the app, with storage built for that user.

**Auth is email + password**, handled by Supabase. [src/lib/auth.ts](src/lib/auth.ts) wraps the four calls and owns two pure helpers — `validateCredentials` (catches a short or mismatched password before the round trip) and `describeAuthError` (rewrites Supabase's terser messages into something actionable). [useSession](src/hooks/useSession.ts) subscribes to `onAuthStateChange`, so signing out anywhere — including another tab — swaps the screen without a reload.

⚠️ The initial session read is asynchronous, because a persisted session may need its token refreshed first. Rendering the login page during that window would sign the student out on every reload; that's what `isLoading` prevents.

**One row per user.** [supabaseCourseStorage](src/lib/supabaseCourseStorage.ts) implements `CourseStorage` against `public.user_data`:

```sql
user_data(user_id uuid primary key references auth.users, version int, data jsonb, updated_at timestamptz)
```

`data` holds the same `{ version, courses, semesters }` envelope `localStorage` holds, so `migrate` opens a Supabase row and a browser payload identically, and a row written by an older build still loads. Reads use `maybeSingle()` — a brand new account has no row, which is not an error. Writes `upsert` on the primary key, so the first save inserts and the rest update, with no "have I created my row yet?" bookkeeping.

**A JSONB blob, not four relational tables.** The app already loads and saves everything at once, so per-row sync buys nothing, and a policy on one row is much smaller to get right than four. The costs, accepted knowingly: no server-side querying, whole-document writes, and last-write-wins if the same account edits in two tabs at once.

⚠️ **RLS is the entire access-control story.** The anon key ships in the browser bundle, so without the policies in [0001_user_data.sql](supabase/migrations/0001_user_data.sql) any visitor could read every row. `using` gates which rows are visible; `with check` gates what a row may become, which is what stops a write aimed at someone else's `user_id`. If you add a table, enable RLS on it in the same migration.

**Writes are debounced.** The store autosaves on every state change, which against `localStorage` was free and against a network is not — typing "87" into a marks field is two renders. [debouncedStorage](src/lib/debouncedStorage.ts) decorates any `CourseStorage`, coalescing a burst into one write of the newest data (600 ms) while still settling every superseded `save`'s promise, so a caller awaiting it learns whether their edit landed. `useAccountStorage` flushes it on `pagehide` and on unmount. That flush is best-effort: the browser may not stay alive for the round trip, so an edit made in the last fraction of a second before the tab closes can still be lost.

**Pre-accounts data isn't stranded.** [useLocalDataImport](src/hooks/useLocalDataImport.ts) offers the browser's old `localStorage` courses to an account that has none, once per user (the answer is remembered under `ubc-grade-calculator-local-import-offered:<userId>`). It deliberately never merges — it only fires when the account is empty, so there's no "which copy wins" question to get wrong.

`progresses/` (§8) is unchanged and **per-machine, not per-account**: it's an export/backup mechanism, and it doesn't know who's signed in.

## 6. Grade calculation

The maths is pure and split across two modules. [gradeCalculations.ts](src/lib/gradeCalculations.ts) aggregates; [gradePolicies.ts](src/lib/gradePolicies.ts) holds the drop/downweight rules. Neither knows how a grade is displayed — that's [gradeFormatting.ts](src/lib/gradeFormatting.ts). Nothing is memoized; the tree is small and recomputes on every render.

**The model is total marks, not average percentages.** A breakdown's grade is the sum of marks achieved over the sum of marks available. A 45/50 test therefore counts for five times as much as a 9/10 quiz, instead of both being averaged as 90%. This is what most real syllabi mean by "Assignments 30%".

**Breakdown grade** (`calculateBreakdownGrade`), in order:
1. Collect scored rows via `getEnteredMarks` — ungraded rows are skipped, and so are rows worth 0 marks (nothing to divide by). None left → `null`.
2. If `equalWeightSubBreakdowns` is on, rescale every row to the same size first (`equalizeWeights`) — see below.
3. Exactly one score → return its percentage. **Drop and downweight are skipped for a single score** — you can't drop your only mark.
4. Sort worst-first **by percentage** (`sortByPercentage`), then dispatch on `getActiveAdvancedOption(breakdown)`:
   - **Drop lowest N** (`applyDropLowest`) — drops `min(N, len-1)` worst rows. A dropped row's `fullMarks` leaves the denominator too, so dropping a 0/20 genuinely removes those 20 marks. At least one row always survives.
   - **Downweight lowest N by P%** (`applyDownweightLowest`) — scales the N worst rows' marks *and* their full marks by `1 - P/100`, so the row shrinks rather than distorting the ratio. Returns `null` if every row is discounted to zero weight.
   - **Neither** — the plain total.
5. Drop takes precedence if both are set — `getActiveAdvancedOption` encodes that, and the UI reads the same function, so the calculator and the toggles can't disagree.
6. Finally, `applyFullCreditGrade` scales the result if a threshold is set.

**Equal weight sub-breakdowns.** `equalizeWeights(pairs)` restates every row out of `EQUAL_WEIGHT_FULL_MARKS` (100) while keeping its percentage, so an 18/20 and a 4/5 both become 90/100. Summing those is then arithmetically a plain average of the row percentages — which is the point: a syllabus that marks four assignments out of 10, 20, 25 and 30 but calls each one 5% of the course is asking for exactly this.

It applies **before** everything else, and that ordering is what makes it compose:

- Rescaling preserves each row's percentage, so `sortByPercentage` ranks them identically — drop-lowest still drops the worst *score*, not the smallest item.
- Drop and downweight then operate on rows of equal size, so dropping one removes exactly `1/n` of the breakdown.
- Full credit still scales the finished percentage afterwards, unchanged.
- Bonus marks survive: a 12/10 becomes 120/100, so the breakdown can still exceed 100%.

It is not part of the mutually-exclusive pair — it decides *what the marks add up to*, not which marks count — so it is a plain boolean on the breakdown rather than a case in `AdvancedOption`. With every row already out of the same number of marks it is a no-op, which is why v1 data (§5) and any uniformly-marked breakdown calculate the same either way.

**Rescaling one row's full marks.** `rescaleAchievedMarks(achieved, oldFull, newFull)` restates a single row when the course marks it out of a different total — 8/10 out of 20 is 16/20 — and drives the *Change full mark* dialog (§7). It keeps the percentage, keeps a `null` score `null`, leaves the score alone when `oldFull` is `null` or `0` (no percentage to scale from), and never clamps, so a 22/20 rescaled to /40 is 44/40. It is the one place a stored mark is rounded — to 6 decimal places, so `7/9` out of 20 stores `15.555556` rather than 17 digits of binary noise. Typing over the two boxes in the row is still the other operation: that changes the score.

**Full credit grade.** A course might say "80% on the iClickers earns full marks". With a threshold `x`, the breakdown grade becomes `min(100, raw / x * 100)`:

- At `x = 60`, a raw 60% → `60 / 60 × 100` = **100%**.
- A raw 59% → `59 / 60 × 100` = **98.33%** (unrounded 98.333…).
- A raw 80% → the bare ratio is 133%, but "or higher earns full credit" means it **caps at 100%**.
- `x = 100` is the identity; `x = 0` awards full credit rather than dividing by zero.
- The threshold has **no default**: switching Full Credit on reveals an empty field, and a blank threshold applies no scaling. `PolicyDraft` carries a `fullCredit` boolean beside the text for this, since `null` already means "off" and can't also mean "on but not yet typed".

It is **independent of drop/downweight**, not a third member of the exclusive pair: those decide *which marks count*, this scales *the percentage they produce*, so "drop lowest 2 and 80% earns full credit" is expressible — which matches real iClicker schemes. `advancedOptionUpdate` therefore returns only the marks fields (`MarksPolicyFields`), so switching between drop and downweight leaves the threshold intact. It also applies to a single score, unlike drop and downweight.

Note the interaction with bonus marks: a threshold caps the breakdown at 100%, so a 22/20 that normally reads 110% reads 100% once a threshold is set. With no threshold (the default) bonus marks still exceed 100% as before.

Ranking is by percentage, not by raw marks lost: a 4/10 is dropped ahead of a 15/20, even though the 15/20 shed more marks. Tests pin this down.

**Backward compatibility.** When every row is out of 100, total-marks arithmetic reduces *exactly* to the old average — including under both policies. That's why migrated v1 data (§5) keeps the grade it always had, and there are tests asserting each of the three paths reduces correctly.

**Course grade** (`calculateCourseGrade`) sums each breakdown's `calculateWeightedValue` across breakdowns that have *both* a grade and a weight; returns `null` if none qualify. It does **not** check that weights sum to 100 — that gate is `areWeightsValid(breakdowns)`, called by both consumers:
[CourseSection.tsx](src/components/CourseSection.tsx) shows a warning alert and renders `—` when it fails.

**Bonus breakdowns** (`isBonus`) are summed by `calculateCourseGrade` like any other — that is exactly what makes them bonus — but `getTotalWeight` leaves them out, so the *other* breakdowns still have to total 100 on their own. A 5% bonus on a full course can therefore push the final grade to 105. `getBonusWeight` reports the extra credit available, which `CourseSection` shows as a note so a course that adds up correctly doesn't look short. A bonus cannot fill a gap: weights of 90 plus a 10% bonus still warn.

`areWeightsValid` compares against 100 with a `1e-9` tolerance rather than `===`. Summing decimal weights drifts: `0.01 + 64.04 + 35.95` evaluates to `100.00000000000001`, and exact equality used to hide the final grade behind a warning that read "weights total 100.0%". The tolerance absorbs float error only — `33.33 × 3 = 99.99` is a real shortfall and still warns.

**One scale, letters and colours together.** `LETTER_SCALE` in [gradeFormatting.ts](src/lib/gradeFormatting.ts) is a single table — threshold, letter, text class, background class — so a grade can never be lettered `A-` and coloured as something else:

| Letter | ≥ | Light theme | Dark theme |
|---|---|---|---|
| A+ / A | 90 / 85 | `--grade-a` `#008A00` | `#00FF00` |
| A- | 80 | `--grade-a-minus` `#548A00` | `#ADFF2F` |
| B+ / B / B- | 76 / 72 / 68 | `--grade-b` `#7A7A00` | `#FFFF00` |
| C+ / C / C- | 64 / 60 / 55 | `--grade-c` `#8A7000` | `#FFD000` |
| D | 50 | `--grade-d` `#FF6600` | `#FF6600` |
| F | below | `--grade-f` `#FF0000` | `#FF0000` |

Several letters deliberately share a colour: the colour says which grade family a mark is in, the letter says where in it. `bandFor` clamps to `[0, 100]` first, since a bonus can push a percentage past 100 and there is no band above A+. An unentered grade gets `text-muted-foreground` / `bg-muted`.

**The dark column is the specified palette; the light column is it, darkened.** Same hues, lightness dropped to ~24–27% so each clears roughly 4.5:1 against a white card — at full brightness `#FFFF00` and `#ADFF2F` were close to illegible on `--card`, and the grade is the one number on the screen that has to be readable. Orange and red already were, so they're unchanged, which does leave the bottom two bands more vivid than the top four. Keep the pairing if you touch this: dark colours on the light theme, bright ones on `.dark`.

**The letter follows the official grade, not the exact one.** A course is recorded with its percentage rounded to a whole number, and the letter is read against *that*: `toOfficialGrade` (`Math.round`) is applied before `getLetterGrade`, so a 79.6 is an 80 and grades as an A-, not a B+. `GradeDisplay` shows the whole chain — `79.60 → 80 : A-` — because the exact figure is what explains the official one, and **everything coloured belongs to the official half**: `80 : A-` carries both the text colour and the tinted chip, while the exact percentage stays `text-foreground` and the arrow `text-muted-foreground` on no background at all. A wash behind the whole pill made all three read as one graded number. Breakdown grades have no official grade, so they show one number and the tint returns to the pill itself.

### Precision and rounding

Every calculation runs at full IEEE-754 double precision — roughly 15–17 significant digits, well beyond the 6 decimal places required — and **nothing is rounded at any intermediate step**. Marks are summed, divided, then weighted, all unrounded.

Rounding happens exactly once, at the display boundary: `formatGrade` in [gradeFormatting.ts](src/lib/gradeFormatting.ts) applies `DISPLAY_DECIMALS` (2). So a 1/3 shows as `33.33` while the underlying value is `33.33333333333333`, and that full value is what feeds the weighted total.

Because each figure is rounded independently for display, a column of them can fail to visibly add up — 33.33 + 33.33 + 33.33 reads as 99.99. The header carries a standing note saying so. Never round inside `gradeCalculations.ts` to make the display tidy; that would compound error across a course.

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
4. **Course grade** = `32.0 + 46.8` = **78.8** → recorded as **79**, letter **B+** (≥76), coloured as a B.

Now switch *drop lowest 1* on for Assignments:

- Ranked by percentage: `4/10` (40%), `18/20` (90%), `10/10` (100%). The 4/10 goes.
- Remaining: `(18 + 10) / (20 + 10)` = `28/30` = **93.3%** — note the dropped row's 10 marks left the denominator too.
- Contribution `37.3`, course grade **84.1** → **A-**.

And with *downweight lowest 1 by 50%* instead:

- The 4/10 becomes `2/5`; the rest are untouched.
- `(2 + 18 + 10) / (5 + 20 + 10)` = `30/35` = **85.7%**, contribution `34.3`, course grade **81.1**.

Or, with no marks policy but *equal weight* on for Assignments:

- Every row is restated out of 100: `40/100`, `90/100`, `100/100`.
- `(40 + 90 + 100) / 300` = **76.7%** — the average of the percentages, contribution `30.7`, course grade **77.5**. The 20-mark assignment has deliberately lost its double pull.

Finally, delete the Final Exam breakdown. Total weight becomes 40, `areWeightsValid` fails, and the final grade renders `—` even though Assignments has a perfectly valid 80. This is expected behaviour, and the most common source of "the calculator is broken" reports — the warning shows the real total so it's diagnosable.

## 7. UI structure & data flow

```
main.tsx → App.tsx (providers + router + auth gate)
             ├── SupabaseSetupNotice ....... no VITE_SUPABASE_* configured
             ├── pages/Auth.tsx ............ signed out — AuthForm (sign in / register)
             └── pages/Index.tsx ........... owns useGradeStore, header shell, empty state, carousel
                  ├── NewCourseDialog ...... prompts for a course name
                  ├── ImportLocalDataDialog  one-time offer of pre-accounts localStorage data
                  ├── AccountMenu .......... signed-in email + sign out
                  ├── CourseToolbar ........ import / export / new-course actions + their toasts
                  └── CourseSection ........ weight validation, final grade (pinned header), course delete
                       ├── AddBreakdownDialog .. preset picker + weight (one instance per course)
                       └── BreakdownCard ....... weight input, breakdown grade, collapse, advanced toggle
                            ├── SubBreakdownRow ... name + achieved/full mark inputs, change-full-mark
                            │    └── ChangeFullMarkDialog  re-marks a row out of a new total
                            └── AdvancedOptions ... drop / downweight / equal weight / full credit / bonus switches
```

State flows down as props; mutations flow up as `on*` callbacks, with each level closing over its own ID so children stay ID-agnostic. Nothing below `Index` knows the store exists.

**Creation goes through dialogs.** `New Course` and `Add Breakdown` no longer create a blank row inline — each opens a centred modal and only commits on submit, with the confirm button disabled until the form is valid. Both wrap their fields in a `<form>` with a `type="submit"` button, so Return submits from any field. `AddBreakdownDialog` is rendered *inside* `CourseSection`, so each course owns its own instance and there's no question which course a submission belongs to. Its options come from `BREAKDOWN_PRESETS`; picking "Others (Specify)" reveals a free-text name field.

**Deletion goes through one dialog.** Every trash button in the app — sub-breakdown, breakdown, course, semester — opens [ConfirmDeleteDialog](src/components/ConfirmDeleteDialog.tsx) rather than deleting on the click. It's deliberately dumb: no state, no domain knowledge, just a title, a description and a confirm label. The component that renders the trash owns the open flag, since that's what knows which row was clicked, and writes the description itself — a course names its breakdown count, a breakdown its sub-breakdown count, a semester its course count, and a sub-breakdown the marks about to be lost. Generic "are you sure?" copy would hide exactly the thing worth knowing, given there's no undo (§5).

**Numeric inputs go through [NumberInput](src/components/NumberInput.tsx)**, never raw `<Input type="number">`. Browsers step a focused number input on wheel events, so scrolling the page over a field would silently rewrite a mark; `NumberInput` blurs on wheel instead, and `index.css` hides the spinner arrows. Use it for every new numeric field.

**Re-marking a row is its own action.** Editing a row's full-marks box changes the score — 8/10 retyped as 8/20 is a worse grade. When a course re-marks an item out of a different total the score hasn't changed, so [ChangeFullMarkDialog](src/components/ChangeFullMarkDialog.tsx) exists to say which of the two is meant: it takes the new total, previews `8 / 10 (80.00%) becomes 24 / 30`, and commits both fields together via `rescaleAchievedMarks` (§6). It's an edit dialog, so it holds a draft and is `key`ed on `open` like the advanced options modal. Its trigger sits on every sub-breakdown row, labelled by tooltip rather than text so the row still fits two courses side by side.

Progress-file handling lives in [useProgressFile](src/hooks/useProgressFile.ts) — it owns the hidden `<input type="file">`, the read, the parse and the toasts, and is a hook rather than a button so the header and the empty state can both open the same picker.

**Layout:** courses render in a horizontal scroll-snap carousel, each capped at `max-w-md` — narrow enough that two fit side by side on a laptop, which is what the sizing throughout the cards (`text-xs`, `h-7` inputs, `h-6` icon buttons) is in service of. A carousel is a deliberate choice from commit `d3347fb`, not a wrapping grid.

⚠️ **The page itself does not scroll, and that is load-bearing.** `Index` is `h-screen flex flex-col`: the header is `shrink-0`, and the body row below it is `flex-1 min-h-0` with the semester panel and `<main>` scrolling independently. `<main>` is the **only** scroll container for the courses — both axes — which is what lets each `CourseSection` pin its header with `sticky`. Three things break it:

- Wrapping the cards in their own `overflow-x-auto` element. That element becomes the nearest scrollport, and the sticky headers then resolve against a box that never scrolls vertically — they simply stop sticking. The horizontal scroll has to belong to `<main>` itself.
- `overflow-hidden` on the course `Card`. Same failure, one level lower: it makes the card the scrollport.
- A `calc(100vh - 105px)` height. The header wraps to two lines on a narrow window, and the guess is then wrong in a way that pushes the bottom of the panel below the fold with no page scroll to reach it. Hence the flex column.

The pinned header is `sticky -top-3`, cancelling `<main>`'s `pt-3`: at plain `top-0` it pins *below* that padding and rows scroll visibly through the strip above it. It carries `bg-card` under its gradient so the rows can't show through, and the row of cards is `items-start` so a short card ends where its content does and unpins with it.

**Colour tokens are plain hexes, bridged into Tailwind by `token()`.** Every colour lives in [index.css](src/index.css) as `--card: #ffffff` — the format anyone can read, paste into a picker, or match against a design — for both `:root` and `.dark`. The usual shadcn arrangement stores a bare HSL triple (`0 0% 100%`) precisely so `hsl(var(--card) / 0.8)` can add an alpha, which a hex cannot do; `token()` in [tailwind.config.ts](tailwind.config.ts) buys that back:

```ts
bg-card      →  background-color: var(--card)
bg-card/80   →  background-color: color-mix(in srgb, var(--card) calc(.8 * 100%), transparent)
```

Three things hold it together, and each is load-bearing:

- **Map new colours with `token("--x")`, never `"var(--x)"`.** A bare var compiles fine and then silently ignores every `/N` modifier — the tint renders at full opacity, which turns a 10% wash into a solid block of colour.
- **Tailwind 2's `*-opacity-*` core plugins are off.** Left on, they route *every* colour utility through `--tw-bg-opacity`, so even a plain `bg-card` would compile to a `color-mix`. They're unused here anyway; `bg-card/80` is the replacement.
- **`color-mix` is the floor.** Chrome 111+, Safari 16.2+, Firefox 113+ (all 2023). Plain colours don't need it; only the `/N` tints do.

`sidebar.tsx` is patched for the same reason — its `shadow-[…hsl(var(--sidebar-border))]` would resolve to `hsl(#e5e7eb)` and drop the shadow. It's the second vendored file with a local edit, after `select.tsx`.

**AdvancedOptions** holds no rules of its own. It's a controlled field group over a `PolicyDraft`, whose committed form a `Breakdown` satisfies structurally. It reads `getActiveAdvancedOption(policy)` for the current mode and calls `advancedOptionUpdate(option)` to switch, so "drop wins over downweight" and "enabling one clears the other" are defined once in `gradePolicies` and shared with the calculator. Each switch is disabled while the other is active, and `AdvancedOption` is never persisted.

Because it works on a bare policy, the same component serves two places:

- **In "Add breakdown"**, inline behind a collapsed *Advanced options* section, so a policy can be set at creation. `NewBreakdown` extends `GradingPolicy` to carry it through.
- **In the Advanced options modal**, opened from a breakdown's *Advanced* button. Edits go into a draft and only reach the breakdown on **Apply**, so a cancelled edit never moves the grade. The card shows `describePolicy(...)` beside the button, since the options are no longer visible inline.

**Every number in it is raw text while editing** — a `PolicyDraft` (`gradePolicies.ts`), not a `GradingPolicy`. A policy can't express "switched on, box currently empty": a null count *is* what "off" means, so clearing a field to retype it would either turn the option off or snap back to a default under the cursor. The draft splits the two — a boolean for the switch, a string for the box — and:

- `policyDraftErrors(draft)` names any switched-on field left blank, and both dialogs refuse to commit while it returns anything, showing `describeDraftErrors(...)` instead. Blank is legal mid-edit and never on the way out; applying it would mean inventing a number for a grading rule.
- `policyFromDraft(draft)` converts and clamps **on commit**, so typing "100" isn't rewritten to "10" the moment `1` and `0` have been typed. It routes through `advancedOptionUpdate`, keeping Drop Lowest and Downweight mutually exclusive in one place.
- **Bonus Grade** and **Equal Weight** ride in the same draft as plain booleans. Neither is part of the mutually-exclusive pair: bonus changes what the breakdown's *weight* means, equal weight changes what its marks *add up to*, and neither changes which marks count (§6). Being booleans, they need no number and so can never block a commit.

⚠️ The modal's draft is seeded at mount, in an inner component `key`ed on `open`. Two subtler approaches both broke: seeding from an effect that depends on `policy` reset an in-progress draft whenever anything else in the breakdown changed (`policy` is a new object every store update), and relying on Radix to unmount the content on close defers to an exit animation whose `animationend` may never fire. See the comment in [AdvancedOptionsDialog.tsx](src/components/AdvancedOptionsDialog.tsx) before changing it.

## 8. Save / reload progress

Progress lives in `localStorage` automatically (§5). **Save Progress** additionally writes **one JSON file per course** into `progresses/` in the project root, and **Reload Progress** reads them all back. Both happen immediately, with no dialog:

```
grade-calculator/
└── progresses/
    ├── _manifest.json
    ├── CPSC_330.json
    └── Databases_in_Data_Science.json
```

Filenames come from the course name: spaces → underscores, characters filesystems reject stripped, leading dots removed, collisions suffixed `_2` — deduped **case-insensitively**, since macOS and Windows would otherwise let two courses overwrite each other.

Each course file holds the same `{ version, courses }` envelope `localStorage` uses, containing one course. So loading reuses `migrate` and a file written by an older build still opens; the persisted shape is defined once, not twice. Reloading **replaces** the course list — it is not a merge.

**`_manifest.json` holds what no per-course file can:** the semester list and the course order.

```json
{ "version": 6, "semesters": ["2026 Winter Term 1"], "courseOrder": ["8f14e45f-…", "b1c2d3e4-…"] }
```

- **Order.** Reading a folder back gives whatever order the filenames sort in — editors and directory listings sort them alphabetically, which is not the arrangement the student built. `courseOrder` restores it. It's keyed on course **id**, not filename, so renaming a course doesn't shuffle the list. Anything the manifest doesn't mention — a file added by hand, a folder saved by an older build — keeps its filename order at the end rather than being dropped.
- **Semesters.** An empty semester has no course file to live in, so without the manifest it would vanish on reload.
- The manifest is written **even when there are no courses**, since an empty folder still has to remember the semesters. It is reserved before filenames are handed out, so a course called "manifest" can't claim it, and it's skipped when parsing rather than reported as a bad file. A folder with no manifest still loads — alphabetically, with semesters derived from the courses.

**Saving is an overwrite, not an append.** After a save, `progresses/` matches the UI exactly: files whose course no longer exists are deleted, because reload reads *every* JSON in the folder and leftovers would resurrect deleted courses. Deleting all your courses and saving therefore leaves the folder holding **only the manifest** — there is deliberately no "nothing to save" guard, since refusing would leave the previous save behind for the next reload to pick up. Only `.json` files directly in `progresses/` are touched; anything else is left alone, and the toast reports what was removed.

**The save toast counts courses, it doesn't name the folder.** `3 Courses Saved`, not `Saved 3 courses to progresses/<uuid>/` — the destination is the app's bookkeeping and the per-account path is noise. The two places a destination still appears are the failure path (`Could not write to progresses/.`) and the no-server fallback, where the file genuinely went somewhere else: the browser's Downloads folder.

`progresses/` is gitignored — it's personal data, not source.

### Why this needs a server

A browser page **cannot** create a folder or list one. That's a sandbox rule, not a missing library, and the only in-page escape hatch (the File System Access API) forces a folder-picker dialog on every use and is Chromium-only.

So the file I/O happens in Node instead. [vite-plugin-progress-files.ts](vite-plugin-progress-files.ts) adds `GET`/`PUT /api/progress` to the dev *and* preview servers; the page just asks. That's what makes it automatic.

The trade-off: **it only works while a Vite server is running.** A `npm run build` copy served by anything else has no Node process, so the client falls back to one combined download and a manual multi-file picker. `ProgressApiUnavailableError` drives that, and it triggers on a non-JSON response too — a static host answers unknown routes with the SPA's HTML, so a 200 alone isn't proof the API is there.

⚠️ **Filenames arrive from the browser, so the server treats them as untrusted.** `isSafeProgressFileName` rejects separators, dot-segments, null bytes and non-`.json` names, and `resolveProgressPath` additionally verifies the resolved path's directory is the progress folder. Both are tested, including against the names `courseFileName` actually generates — a mismatch there would silently drop a course from the save.

⚠️ **The dev server binds to `host: "::"`** (all interfaces), so this write endpoint is reachable from your local network, not just your machine. Set `host: "localhost"` in `vite.config.ts` if that matters to you.

## 9. Known issues & technical debt

Ordered roughly by how likely each is to bite you.

1. **`strict: false`** in [tsconfig.app.json](tsconfig.app.json), plus `noImplicitAny: false`, `strictNullChecks: false`, and unused-vars linting disabled. Given how much logic hinges on `null` vs `0` (§4), the compiler is not protecting the codebase's central invariant. Enabling `strictNullChecks` is the highest-leverage remaining cleanup — and will surface real findings.
3. **No component test coverage.** `src/lib/*` and the store hook are well covered (450 tests); every React *component* is untested — including `AuthForm`, whose sign-in/register toggle and error rendering are verified by hand only. The dialogs and `AdvancedOptions` carry the most branching.
3b. **`@testing-library/dom` was a missing peer dependency.** RTL 16 requires it, and without it `useGradeStore.test.ts` couldn't even be imported — 23 tests had been silently unrunnable. Now installed as a devDependency. Watch for the same thing if RTL is upgraded.
4. **Dark mode is unreachable.** Full `.dark` variable set in `index.css` and `darkMode: ["class"]` in Tailwind, but nothing ever adds the class; `next-themes` is installed and unmounted. Wiring a `ThemeProvider` is close to free.
5. **Duplicate lockfiles.** `bun.lock` and `package-lock.json` are both present, alongside a `vite` `^5.4.19 → ^8.2.0` bump. Decide on one package manager and commit the matching lockfile.
6. **Unused heavyweight deps** — react-query, recharts, react-hook-form, zod, embla — inflate the bundle without contributing. 30 shadcn primitives are also unused, though those tree-shake.
7. **A row worth 0 marks is silently ignored.** `fullMarks: 0` is representable; the calculator skips such rows rather than dividing by zero, but nothing tells the student why the row stopped counting. Same for a row whose full marks are still blank.
8. **No undo.** Deletes now confirm first (§7), but nothing can be brought back once confirmed. An undo stack, or a soft-delete with a "restore" toast, is the real fix.
9. **Prop drilling.** `CourseSectionProps` takes 9 props and forwards 6 it never uses. Deliberately left as-is: at three levels it stays readable and keeps components trivially testable. Revisit if a fourth level appears.

**Resolved along the way:** float-equality on weight totals; the misleading "totals 100.0%" warning; `exportImport.ts` doing three jobs at once; untestable export code; grading rules duplicated between the calculator and the toggle UI; `generateId`/clamp/weighted-value duplication; `(doc as any)`; the dead `App.css` / `NavLink.tsx` / `ui/use-toast.ts`; and the missing schema version, now handled by the versioned envelope and `migrate` (§5).

## 10. Extension guide

- **New grading policy** (e.g. "best N of M"): add fields to `Breakdown` in `types/grades.ts` → add the rule to `gradePolicies.ts` (an `applyBestOf` over `MarkPair[]`, a case in `getActiveAdvancedOption`, and one in `advancedOptionUpdate`) → add a `case` in `calculateBreakdownGrade`'s switch → add the fields to `PolicyDraft`, `toPolicyDraft`, `policyDraftErrors` and `policyFromDraft` → add a switch to `AdvancedOptions`. The switch is exhaustive over `AdvancedOption`, so TypeScript will point at every site you still need to touch.
- **New breakdown type:** add an entry to `BREAKDOWN_PRESETS` in `breakdownPresets.ts` with its `singular`, **in alphabetical position** — a test enforces the ordering. The dialog and the CSV importer both read from there, so that's the only edit.
- **New term or semester rule:** `TERMS` and the helpers in `semesters.ts`; the panel and dialog both read from there. Anything that changes which semesters exist also has to keep `persistedSemesters` true, or an empty one won't survive a reload.
- **Changing the persisted shape:** bump `SCHEMA_VERSION`, extend `migrate`/`normalizeCourses` in `courseStorage.ts`, and add a test asserting old data still calculates the same. A field added without backfilling deserialises as `undefined`, which any `!== null` check reads as *set*. Saved data is the one thing here that can't be regenerated.
- **New route:** add `<Route>` in `App.tsx` above the `*` catch-all, create the page in `src/pages/`.
- **Deeper store access:** convert `useGradeStore` into a Context provider rather than calling the hook twice (§5).
- **New UI primitive:** `npx shadcn@latest add <name>` — never hand-write into `src/components/ui/`.
- **New semantic color:** hex var in both `:root` and `.dark` in `index.css`, then map it in `tailwind.config.ts` as `token("--your-var")` — a bare `"var(--your-var)"` compiles, but silently ignores every `/N` opacity modifier. For a *grade* colour, add the class strings to the `LETTER_SCALE` row that uses them — spelled out as literals, since Tailwind only ships classes it can find by scanning.
- **New export format:** write a pure `build…` function, then a wrapper that calls `downloadBlob` with `timestampedFilename`. Keep the wrapper too small to need a test.
- **Replacing the favicon:** drop the file in `public/`, point the `<link rel="icon">` at it, and bump the `?v=` query — otherwise browsers keep serving the cached one.
- **Another storage backend:** implement `CourseStorage` (async `load`/`save`) and pass it to `useGradeStore` — the store depends on the interface, not on any one backend. Wrap it in `debouncedStorage` if writes cost anything, and give it a stable identity (§5).
- **Another sign-in method** (Google, magic link): enable the provider in the Supabase dashboard, add a wrapper in `src/lib/auth.ts`, and add a button to `AuthForm`. Nothing else needs to change — the gate only cares whether there's a session.
- **A second Supabase table:** add it to a numbered file in `supabase/migrations/`, and **enable RLS with a `user_id = auth.uid()` policy in the same migration** (§5a). A table without RLS is readable by anyone holding the anon key, which is everyone.

## 11. Symptom → cause map

| Symptom | Likely cause | Look in |
|---|---|---|
| "Supabase isn't configured yet" screen | No `.env.local`, or the dev server wasn't restarted after writing one (§3) | `isSupabaseConfigured` in [supabase.ts](src/lib/supabase.ts) |
| Signed in, but the account looks empty | RLS policy missing or wrong, so the row is filtered out rather than returned | [0001_user_data.sql](supabase/migrations/0001_user_data.sql) |
| "Couldn't load your courses" | The read failed; the store refuses to save on top of it by design (§5) | `loadError` in [useGradeStore.ts](src/hooks/useGradeStore.ts) |
| Edits stop persisting after a moment offline | Expected — `saveError` toasts, the edit stays on screen unsaved (§5) | `saveError` in [useGradeStore.ts](src/hooks/useGradeStore.ts) |
| The app reloads data in an endless loop | `storage` isn't identity-stable across renders (§5) | [useAccountStorage.ts](src/hooks/useAccountStorage.ts) |
| Last edit lost when the tab was closed instantly | Debounced save hadn't fired; the `pagehide` flush is best-effort (§5a) | [debouncedStorage.ts](src/lib/debouncedStorage.ts) |
| Registering seems to do nothing | Email confirmation is on — the form says to check the inbox (§3) | Supabase → Authentication → Sign In / Providers |
| "Could not reach the server" on sign in | Wrong `VITE_SUPABASE_URL`, or genuinely offline | `describeAuthError` in [auth.ts](src/lib/auth.ts) |
| Old localStorage courses seem gone after signing in | They're offered once per account; declining is remembered (§5a) | [useLocalDataImport.ts](src/hooks/useLocalDataImport.ts) |
| Final grade shows `—` despite marks entered | Breakdown weights genuinely don't reach 100 — the warning shows the real total | [CourseSection.tsx](src/components/CourseSection.tsx), `areWeightsValid` |
| Breakdown grade isn't the average of the row percentages | Working as designed — it's total marks over total available (§6). Switch **Equal Weight** on to get the average | `totalPercentage` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| Breakdown grade *is* the average, and shouldn't be | **Equal Weight** is on — the card says "Equal weight" beside *Advanced* (§6) | `equalizeWeights` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| A mark changed on its own after editing full marks | *Change full mark* rescales the score to keep its percentage; typing in the box doesn't (§7) | `rescaleAchievedMarks` in [gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| A rescaled mark has six decimal places | Expected — the percentage doesn't divide evenly, e.g. 7/9 out of 20 (§6) | `rescaleAchievedMarks` in [gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Course headers scroll away instead of pinning | Something wrapped the cards in a second scroll container, or `overflow-hidden` came back on the card (§7) | [Index.tsx](src/pages/Index.tsx), [CourseSection.tsx](src/components/CourseSection.tsx) |
| Rows visible in a strip above a pinned header | The header lost `-top-3`, so it pins below `<main>`'s padding (§7) | [CourseSection.tsx](src/components/CourseSection.tsx) |
| Only one course fits on screen | The card cap grew past `max-w-md`, or the window is genuinely narrow (§7) | [Index.tsx](src/pages/Index.tsx) |
| A row shows a percentage but doesn't affect the grade | Its `fullMarks` is 0, so `getEnteredMarks` skips it | [gradeCalculations.ts](src/lib/gradeCalculations.ts), `getEnteredMarks` |
| A grade reads over 100% | By design — bonus marks are allowed and nothing is clamped | `getEnteredMarks` in [gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Bonus marks stopped exceeding 100% | A full credit threshold is set, which caps the breakdown (§6) | `applyFullCreditGrade` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| Setting a marks policy cleared the full credit threshold | `advancedOptionUpdate` must return only `MarksPolicyFields` and be spread, not assigned | [gradePolicies.ts](src/lib/gradePolicies.ts) |
| A row with marks entered doesn't count | Its full marks are still blank, or are 0 | `getEnteredMarks` in [gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Displayed figures don't add to 100% | Expected — each is rounded to 2 dp independently (§6) | `DISPLAY_DECIMALS` in [gradeFormatting.ts](src/lib/gradeFormatting.ts) |
| Scrolling the page changed a mark | A raw `<Input type="number">` slipped in instead of `NumberInput` | grep for `type="number"` outside [NumberInput.tsx](src/components/NumberInput.tsx) |
| A mark of `0` is ignored | Somewhere used `||` instead of `??`, collapsing 0 to "unset" | grep for `\|\| ''` / `\|\| 0` |
| Marks typed but breakdown still `—` | Non-numeric input never reached the store — `handleAchievedChange` drops `NaN` | [SubBreakdownRow.tsx](src/components/SubBreakdownRow.tsx) |
| Wrong row got dropped by "drop lowest" | Ranking is by percentage, not raw marks lost (§6) | `sortByPercentage` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| Old saved data vanished after an update | `migrate` didn't recognise the shape — check the console and the `version` field | [courseStorage.ts](src/lib/courseStorage.ts), `migrate` |
| Reload Progress wiped everything | It replaces, never merges (§8). A file that fails validation leaves data intact | `looksLikeProgress` in [progressFile.ts](src/lib/progressFile.ts) |
| Save downloads a file instead of writing progresses/ | No Vite server behind the page — a static build has no Node process (§8) | `ProgressApiUnavailableError` |
| A semester disappeared after reload | Its anchor is `_manifest.json`; check the folder has one and lists it (§4a, §8) | `persistedSemesters` in [semesters.ts](src/lib/semesters.ts) |
| Courses came back in the wrong order | The manifest is missing or predates the course, so it fell back to filename order (§8) | `orderCourses` in [progressFile.ts](src/lib/progressFile.ts) |
| A course's weights total 100 but the grade shows `—` | One of them is marked Bonus, so it doesn't count towards the 100% (§6) | `getTotalWeight` in [gradeCalculations.ts](src/lib/gradeCalculations.ts) |
| Apply in Advanced options does nothing | A switched-on option has an empty box; the dialog says which (§7) | `policyDraftErrors` in [gradePolicies.ts](src/lib/gradePolicies.ts) |
| A trash button doesn't delete anything | By design — it opens a confirmation first (§7) | [ConfirmDeleteDialog.tsx](src/components/ConfirmDeleteDialog.tsx) |
| A semester in the panel reads "2024S1" | The panel abbreviates; hover for the full label (§4a) | `shortSemesterLabel` in [semesters.ts](src/lib/semesters.ts) |
| The letter grade disagrees with the percentage | Expected — the letter follows the *rounded* grade, e.g. 79.6 → 80 → A- (§6) | `toOfficialGrade` in [gradeFormatting.ts](src/lib/gradeFormatting.ts) |
| Old courses missing from the panel | They should be under **Unassigned**; check `migrate` backfilled `semester` to `''` | [courseStorage.ts](src/lib/courseStorage.ts) |
| New Course does nothing | No semester selected — courses must belong to one (§4a) | `openNewCourse` in [Index.tsx](src/pages/Index.tsx) |
| A course vanishes from the save | Its generated filename failed the server's safety check; the two must agree | `courseFileName` vs `isSafeProgressFileName` |
| A deleted course came back after reload | Stale-file pruning didn't run, or the folder holds files from an older save | `writeProgressFiles` in [vite-plugin-progress-files.ts](vite-plugin-progress-files.ts) |
| Saving with no courses left the old files | Save must always run, even for an empty list — a "nothing to save" guard reintroduces this | `saveProgress` in [useProgressFile.ts](src/hooks/useProgressFile.ts) |
| Two courses with the same name overwrite each other | Filename dedupe must be case-insensitive | `courseFileName` in [progressFile.ts](src/lib/progressFile.ts) |
| The tab icon is stale after replacing it | Bump the `?v=` on the icon link; browsers cache favicons hard | [index.html](index.html) |
| A long dropdown runs off screen | `SelectContent` must stay capped to `--radix-select-content-available-height` | local fix in [select.tsx](src/components/ui/select.tsx) |
| Breakdown added to the wrong course | Each `CourseSection` owns its own `AddBreakdownDialog`; suspect one hoisted to a shared parent | [CourseSection.tsx](src/components/CourseSection.tsx) |
| New sub-breakdown name duplicates an existing one | `nextSubBreakdownName` continues past the highest number used; a renamed row won't match the pattern | [breakdownPresets.ts](src/lib/breakdownPresets.ts) |
| Two parts of the UI disagree about state | A second `useGradeStore()` call created a rival store (§5) | grep `useGradeStore` — must appear once |
| Delete does nothing on a sub-breakdown | It's the last one; deletion is blocked by design | [useGradeStore.ts](src/hooks/useGradeStore.ts), `deleteSubBreakdown` |
| Dark styles never apply | No `ThemeProvider` mounts; `.dark` is never added (§9) | `App.tsx` |
| A `/N` tint renders solid, or a colour vanishes | The token was mapped as a bare `var(--x)` instead of `token("--x")` (§7) | [tailwind.config.ts](tailwind.config.ts) |
| Colours are missing on an old browser | `color-mix` backs every `/N` tint; it needs Chrome 111+, Safari 16.2+, Firefox 113+ (§7) | [tailwind.config.ts](tailwind.config.ts) |

## 12. Glossary

Terms are used consistently across code, UI, and CSV headers — keep it that way.

- **Semester** — a year plus one of UBC's four terms, e.g. "2026 Summer Term 2". Groups courses; stored on each course rather than as its own record.
- **Course** — a class, belonging to one semester. Has a final grade only when its breakdown weights total 100.
- **Breakdown** — a weighted category within a course ("Assignments", "Final Exam"). Carries the weight and the optional grading policy. Formerly called a "component"; that word now means React component only.
- **Sub-breakdown** — one graded item inside a breakdown ("Assignment 1", "Quiz 3"). Holds the marks achieved and the marks available.
- **Marks achieved** (`achievedMarks`) — what the student scored, in marks. `null` until entered.
- **Full marks** (`fullMarks`) — what the item was out of. Blank until entered; a row without it is excluded from the totals. Legacy data defaults to 100 (`LEGACY_FULL_MARKS`).
- **Weight** — a breakdown's percentage share of the course. Sub-breakdowns are never individually weighted; their marks are totalled, then the breakdown's weight applies once.
- **Breakdown grade** — total marks achieved over total marks available within a breakdown, as a percentage, after any policy adjustment. *Not* an average of the row percentages.
- **Weighted value / weighted grade** — `breakdownGrade × weight / 100`, i.e. the points a breakdown contributes to the course total. Shown as "Weighted:" in `BreakdownCard`.
- **Drop lowest N** — exclude the N worst-scoring sub-breakdowns, ranked by percentage. Their full marks leave the total too. Always keeps ≥1.
- **Downweight lowest N by P%** — scale the N worst-scoring sub-breakdowns' marks *and* full marks by `1 - P/100`.
- **Equal weight** (`equalWeightSubBreakdowns`) — every sub-breakdown counts the same regardless of its full marks, making the breakdown grade an average of the row percentages. The one opt-out from the marks model.
- **Advanced option** — the drop/downweight choice. Derived from field nullability at render time, never stored.
- **Grading policy** (`GradingPolicy`) — the policy fields on their own, so the same UI can edit a saved breakdown or a not-yet-created draft.
- **Full credit grade** (`fullCreditGrade`) — the percentage that earns 100% for a breakdown. Lower scores scale up proportionally; at or above it, full credit. Combines with a marks policy.
- **Change full mark** — re-marking one row out of a different total, scaling its score to keep the percentage. Distinct from editing the full-marks box, which changes the score.
- **Sub-breakdown label** (`subBreakdownLabel`) — the singular noun used to auto-name rows ("Assignment" → "Assignment 3").
- **Grade band** — a row of `LETTER_SCALE`: a threshold, the letter it earns, and the colour both are shown in (§6).
