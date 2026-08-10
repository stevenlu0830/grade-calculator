# Codebase Index

> Structural map of the UBC Grade Calculator. AI-optimized: paths + responsibilities, no prose.
> **Stack:** Vite 8 + React 18 + TypeScript + Tailwind 3 + shadcn/ui + Supabase (auth + storage).
> **Vocabulary:** Semester → Course → **Breakdown** (weighted category) → **Sub-breakdown** (one graded item). "Component" now means *React component* only.

## Quick orientation

| I want to... | Go to |
|---|---|
| Change sign-in, registration or the auth gate | [src/lib/auth.ts](src/lib/auth.ts), [src/components/AuthForm.tsx](src/components/AuthForm.tsx), [src/App.tsx](src/App.tsx) |
| Change where account data is stored, or the SQL/RLS | [src/lib/supabaseCourseStorage.ts](src/lib/supabaseCourseStorage.ts), [supabase/migrations/0001_user_data.sql](supabase/migrations/0001_user_data.sql) |
| Change semesters, terms or their ordering | [src/lib/semesters.ts](src/lib/semesters.ts) |
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
- [src/App.tsx](src/App.tsx) — providers `QueryClientProvider` → `TooltipProvider` → `Toaster` + `Sonner` → `BrowserRouter` → `AuthGate`.
  - `AuthGate` picks one of four: `SupabaseSetupNotice` (no env), `FullPageLoader` (session loading), `Auth` (signed out), `SignedInApp`.
  - `SignedInApp` is `key`ed on the user id so switching account remounts the tree — storage swaps on its own, but local UI state (selected semester) would otherwise carry across.
  - `UserWorkspace` builds the storage via `useAccountStorage` and holds the routes: `/` → `Index`, `*` → `NotFound`.
  - `@tanstack/react-query` is mounted but **unused** — zero queries anywhere.

## Domain model — `src/types/grades.ts`

Three-level tree; parent IDs denormalized onto children.

- `GradeData` — `{ courses, semesters }`, everything the app persists. The order of `courses` is meaningful and is preserved across a save and reload.
- `Course` — `{ id, name, semester, breakdowns }`
  - `semester` is a label like `"2026 Summer Term 2"`; `''` means unassigned. Courses name their semester **and** it's on `GradeData.semesters`, which is what anchors one with no courses in it.
- `Breakdown` — `{ id, courseId, name, weight, dropLowestCount, downweightLowestCount, downweightPercent, fullCreditGrade, isBonus, subBreakdownLabel, subBreakdowns }`
  - `fullCreditGrade: number | null` — the percentage that earns 100%. **Independent** of drop/downweight, which it composes with.
  - `isBonus: boolean` — extra credit: the weight lands on top of the course's 100% instead of inside it.
  - `subBreakdownLabel` is the singular noun used to auto-name rows ("Assignment" → "Assignment 3").
- `SubBreakdown` — `{ id, breakdownId, name, achievedMarks: number | null, fullMarks: number | null }`
  - `achievedMarks` is **marks scored, not a percentage**. `null` = not entered, never 0.
  - `fullMarks: number | null` — blank until entered; the row is excluded from totals until then. Never clamps `achievedMarks`, so bonus marks are allowed.
- `AdvancedOption` — `'none' | 'dropLowest' | 'downweight'` (derived, never persisted).
- `Term` — the four UBC terms.

## Domain — `src/lib/gradeCalculations.ts`

- `clampPercentage(v)` — `[0, 100]`, used **only** for picking a letter grade; a breakdown's own percentage is never clamped.
- `getEnteredMarks(subBreakdowns)` — scored rows only; skips rows with no full marks yet and rows worth 0 marks (can't divide by them). Marks above full marks are kept.
- **Precision:** full float64 throughout, no intermediate rounding. Rounding happens once, in `gradeFormatting`.
- `calculateBreakdownGrade(breakdown)` — **total achieved / total available**, as a percentage, then scaled by `applyFullCreditGrade`. `null` if ungraded; a single score bypasses drop/downweight (but **not** full credit); otherwise dispatches on `getActiveAdvancedOption`.
- `calculateWeightedValue(breakdown)` — the breakdown's contribution in points.
- `calculateCourseGrade(breakdowns)` — sums `calculateWeightedValue`; `null` if nothing qualifies. Does **not** validate weights. Bonus breakdowns are summed like any other — that's what makes them bonus.
- `getTotalWeight(breakdowns)` — sums weights **excluding bonus**, so a correctly-weighted course with extra credit still reads 100.
- `getBonusWeight(breakdowns)` — the extra credit available on top; `CourseSection` shows it as a note.
- `areWeightsValid(breakdowns)` — the single 100% gate, `1e-9` tolerance so float drift can't hide a valid grade. Used by `CourseSection`. A bonus can't fill a shortfall.
- Constants: `PERCENTAGE_MIN/MAX`, `LEGACY_FULL_MARKS` (100, for reading v1 data and pre-`Full Marks` CSVs only), `REQUIRED_TOTAL_WEIGHT`.

## Policies — `src/lib/gradePolicies.ts`

Domain rules shared by the calculator and the toggle UI so they can't disagree. Operates on `MarkPair { achieved, full }`.

- `GradingPolicy` — the policy fields (`dropLowestCount`, `downweightLowestCount`, `downweightPercent`, `fullCreditGrade`, `isBonus`). A `Breakdown` satisfies it structurally, so the same helpers serve a saved breakdown *and* the policy a dialog commits.
- `MarksPolicyFields` — the mutually-exclusive trio (drop + downweight). `fullCreditGrade` sits outside it deliberately.
- `NO_POLICY` — frozen all-nulls starting point.
- `getActiveAdvancedOption(policy)` — derives the mode from field nullability. Drop wins if both set.
- `advancedOptionUpdate(option)` — the **marks fields only** for a mode, clearing the one it replaces, so spreading it preserves `fullCreditGrade`. Returns a fresh object, never `NO_POLICY` itself.
- `applyFullCreditGrade(percentage, threshold)` — `min(100, pct / threshold * 100)`. A `null`/`undefined` threshold is a no-op; `0` awards full credit rather than dividing by zero.
- `describePolicy(policy)` — one-line summary, or `null`. **Joins** parts with ` · ` since full credit combines with a marks policy; "Bonus" reads first, because it changes what the weight means. Shared by the breakdown card and the add dialog.
- `PolicyDraft` + `toPolicyDraft` / `policyFromDraft` / `policyDraftErrors` / `describeDraftErrors` / `NO_POLICY_DRAFT` — a policy **mid-edit**, with every number as raw text so a box can be emptied and retyped. A `GradingPolicy` can't express "switched on, box empty" (a null count *is* "off"). `policyDraftErrors` names any switched-on field left blank; both dialogs refuse to commit until it's empty. `policyFromDraft` clamps **on commit**, not per keystroke, and routes through `advancedOptionUpdate` so exclusivity lives in one place.
- `percentageOf` / `sortByPercentage` — ranking is **by percentage**, so 4/10 ranks below 15/20.
- `totalPercentage(pairs)` — summed marks over summed availability; `null` if nothing available.
- `applyDropLowest(sorted, count)` — drops N worst; their `full` leaves the denominator too. Keeps ≥1.
- `applyDownweightLowest(sorted, count, percent)` — scales both sides of the fraction; `null` if all weight vanishes.
- `clampPercent`, `DEFAULT_DROP_LOWEST_COUNT`, `DEFAULT_DOWNWEIGHT_COUNT`, `DEFAULT_DOWNWEIGHT_PERCENT`.

## Semesters — `src/lib/semesters.ts`

- `TERMS` — the four terms in **chronological order within an academic year** (Winter Term 1 starts in September), not alphabetical.
- `formatSemester(year, term)` / `parseSemester(label)` — `"2026 Summer Term 2"` both ways.
- `compareSemestersDescending` — most recent first; unparseable labels (including unassigned) sort **last**.
- `semestersFromCourses` / `visibleSemesters(courses, semesters)` — the panel's list: the union of the saved list and whatever the courses name.
- `persistedSemesters(courses, semesters)` — the same union **minus the unassigned bucket**, applied by the store on load and import. Data saved before the list existed heals into it instead of losing a semester when its last course goes.
- `coursesIn` / `countCoursesIn` / `semesterLabel` — filtering and display; `''` renders as "Unassigned".
- `shortSemesterLabel(semester)` — `"2023 Winter Term 1"` → `"2023W1"`, for the panel only, where the full label got truncated to "2023 Winter Te…". Display-only: nothing parses it back, and the tooltip hands the full label straight back on hover.
- `semesterYearOptions(referenceYear)` — next year back through five, newest first. Takes the year so it stays pure.

⚠️ An empty semester survives a reload only because it's on the saved list — and in `progresses/`, only because of `_manifest.json`.

## Presets — `src/lib/breakdownPresets.ts`

- `BREAKDOWN_PRESETS` — the 12 offered types in **ascending alphabetical order, case-insensitively** (so iClickers sits before In-class Exercises, not after WebWorks); each carries an explicit `singular`, spelled out because rules mangle Quizzes/WebWorks. A test enforces the ordering.
- `OTHER_BREAKDOWN` — sentinel for "Others (Specify)".
- `presetFor(label)` — preset lookup; an unknown name is its own singular.
- `nextSubBreakdownName(label, existingNames)` — `<label> <n>`, continuing past the highest number used so deletions don't cause collisions.

## Presentation — `src/lib/gradeFormatting.ts`

- `DISPLAY_DECIMALS` (2) — the single rounding point in the whole app.
- `formatGrade(grade)` — rounded to `DISPLAY_DECIMALS`, or `—`.
- `formatWeight(weight)` — up to 2 decimals, trailing zeros dropped, so a 99.99 shortfall doesn't render as "100.0".
- `toOfficialGrade(grade)` / `formatOfficialGrade(grade)` — the grade a course is **recorded** with: the percentage rounded to a whole number, half up. Not clamped, so a bonus can exceed 100.
- `getLetterGrade(grade)` — UBC scale from the `LETTER_SCALE` table. Callers pass the **official** grade, so a 79.6 grades as an A-.
- `getGradeColor` / `getGradeBg` — one `COLOUR_BANDS` table pairing text + background.
- `NO_GRADE` — the `—` placeholder.

⚠️ Two scales coexist deliberately: colour bands at 90/80/70/60, letter grades on the UBC scale. An 82 is green and an `A-`.

⚠️ A course's final grade renders as `79.60 → 80 : A-` — exact, official, letter. The colour follows the official value too, so the letter and the colour can't disagree. Breakdown grades have no official value; only courses do.

## Auth & accounts

- [src/lib/supabase.ts](src/lib/supabase.ts) — the client singleton and the **only** place `import.meta.env` is read. `supabase` is `null` when unconfigured so importing can never throw; `isSupabaseConfigured` gates the gate, `requireSupabase()` throws with setup instructions. Exports `USER_DATA_TABLE`.
- [src/lib/auth.ts](src/lib/auth.ts) — `signUpWithPassword` / `signInWithPassword` / `signOut`, plus two **pure** helpers: `validateCredentials(email, password, confirm?)` (a `confirm` of `undefined` means sign-in, so it isn't compared) and `describeAuthError(error)` (Supabase's terse strings → actionable ones; unknown messages pass through rather than being hidden). `MIN_PASSWORD_LENGTH = 6`, matching Supabase's own.
  - `signUpWithPassword` returns `{ needsEmailConfirmation }` = "no session was issued". Supabase returns that same shape for an already-registered email, deliberately, so the form can't be used to enumerate accounts.
- [src/hooks/useSession.ts](src/hooks/useSession.ts) — `getSession()` + `onAuthStateChange` subscription. `isLoading` covers the token-refresh window; rendering the login page during it would sign the student out on every reload.
- [src/hooks/useAccountStorage.ts](src/hooks/useAccountStorage.ts) — `debouncedStorage(supabaseCourseStorage(userId))`, cached in a **ref** keyed on user id. A ref, not `useMemo`: only a ref guarantees the identity the store's effect depends on. Flushes pending writes on `pagehide` and on unmount.
- [src/hooks/useLocalDataImport.ts](src/hooks/useLocalDataImport.ts) — offers pre-accounts `localStorage` data to an **empty** account, once per user (`importOfferKey(userId)`). Never merges, because it only fires when there's nothing to merge with.
- [src/pages/Auth.tsx](src/pages/Auth.tsx) + [AuthForm.tsx](src/components/AuthForm.tsx) — sign in / register in one component with a mode toggle; the differing strings live in a `COPY` table. No success path of its own — the session change is what swaps the screen. Its one self-reported outcome is a registration awaiting an emailed link.
- [AccountMenu.tsx](src/components/AccountMenu.tsx) — email + sign out, in the header.
- [SupabaseSetupNotice.tsx](src/components/SupabaseSetupNotice.tsx) — the four setup steps, shown instead of the app when env vars are missing.

⚠️ The anon key is public by design. **RLS on `user_data` is the only thing separating accounts** — see [supabase/migrations/0001_user_data.sql](supabase/migrations/0001_user_data.sql). Any new table needs its own policy in the same migration.

## State — `src/hooks/useGradeStore.ts`

- `useState<GradeData>` starting at `EMPTY_GRADE_DATA`, replaced by an **async** `storage.load()` in an effect. Returns `isLoading`, `loadError`, `saveError` alongside the data and actions. A local `setCourses(update)` helper edits just the course slice, so semesters ride along untouched.
- **Three guards make an async backend safe** (each has a test):
  - `persisted` ref — the exact object storage last handed over; the save effect bails on reference equality, so a load isn't echoed straight back.
  - `loadError` short-circuits the save effect entirely. The store is empty after a failed read, and writing that would wipe the account.
  - `storage` is an effect dependency, so it **must** be identity-stable — build it with `useAccountStorage`.
- `lastSaveError` ref mirrors `saveError` so a successful save skips the setter unless there was an error to clear (otherwise every edit schedules a pointless render, and tests warn about updates outside `act`).
- **Not a Context.** Called once in `Index.tsx`; a second call would be a rival state tree racing the same key.
- `mapCourse` / `mapBreakdown` helpers keep nested immutable updates flat.
- Actions: `addSemester`, `deleteSemester`, `addCourse(name, semester)`, `deleteCourse`, `updateCourseName`, `addBreakdown(courseId, NewBreakdown)`, `deleteBreakdown`, `updateBreakdown`, `addSubBreakdown`, `deleteSubBreakdown`, `updateSubBreakdown`, `importData`.
- `deleteSemester(label)` drops the label **and every course under it** — `ConfirmDeleteDialog`, opened by `SemesterPanel`, is what stands between it and a misclick. `addCourse` records the semester on the list; `normalize` (via `persistedSemesters`) keeps the invariant on load and import.
- Exports the `NewBreakdown` input type — `{ name, weight, subBreakdownLabel }` **extending `GradingPolicy`**, so the add dialog can set a policy up front.
- Invariants: a breakdown keeps ≥1 sub-breakdown; **marks are stored verbatim with no clamping**; new breakdowns seed one auto-named row with both mark fields blank.

## Persistence & I/O seams

- [src/lib/courseStorage.ts](src/lib/courseStorage.ts) — `CourseStorage` interface (**async** `load`/`save`) + `localCourseStorage`, both trading in `GradeData`. Also `EMPTY_GRADE_DATA`, and `readLocalData()` / `hasLocalData()` — the synchronous reads the sign-in import offer asks its question with. Key `ubc-grade-calculator-data`, stored as `{ version, courses, semesters }`. `SCHEMA_VERSION = 5`.
- [src/lib/supabaseCourseStorage.ts](src/lib/supabaseCourseStorage.ts) — `CourseStorage` over `public.user_data`. Pure `buildUserDataRow(userId, data)` / `parseUserDataRow(row)` split from the effectful `supabaseCourseStorage(userId, client?)`. Stores the **same envelope** `localStorage` does, so both share `migrate`. `maybeSingle()` on read (a new account has no row, which isn't an error); `upsert` on `user_id` for write. Errors **throw** rather than log — the store needs to know a read failed.
- [src/lib/debouncedStorage.ts](src/lib/debouncedStorage.ts) — `debouncedStorage(inner, delayMs = 600)` decorator returning a `FlushableStorage` (`+ flush()`, `cancel()`). Coalesces a burst into one write of the newest data; every superseded `save`'s promise still settles with the write that replaced it. Reads pass straight through. Claims the pending write *before* awaiting, so a save arriving mid-flight queues a fresh timer instead of being dropped. `migrate(raw)` converts bare v1 `components`/`grade` data (defaulting `fullMarks` to `LEGACY_FULL_MARKS`), then `normalizeCourses` backfills fields added later — `fullCreditGrade` and `fullMarks` become `null` rather than `undefined`, which a `!== null` check would otherwise read as *set*, and `isBonus` becomes `false`. Anything older than v5 has no semester list; the store rebuilds it from the courses.
- [src/lib/download.ts](src/lib/download.ts) — `downloadBlob`. The **only** place the app hands a file to the browser.
- [src/lib/id.ts](src/lib/id.ts) — `createId()`, `crypto.randomUUID()` with a fallback.
- [src/lib/exportFormat.ts](src/lib/exportFormat.ts) — `timestampedFilename`.

## Save / reload progress

One JSON file **per course** in `progresses/`, plus a manifest, written automatically with no prompt: "CPSC 330" → `progresses/CPSC_330.json`.

**Client — [src/lib/progressFile.ts](src/lib/progressFile.ts)**
- `courseFileName(name, taken)` — spaces → underscores, filesystem-unsafe characters stripped, **leading dots removed** (the server refuses hidden files, so a course named `..` would otherwise be dropped silently), deduped case-insensitively.
- `PROGRESS_MANIFEST_FILE` (`_manifest.json`) / `isManifestFile` / `buildManifestJson` — `{ version, semesters, courseOrder }`. Holds the two things no per-course file can: semesters with no courses, and the order the courses were in. Written **even with zero courses**, and its name is reserved before filenames are handed out so a course can't claim it.
- `orderCourses(courses, courseOrder)` — puts a reloaded folder back in saved order. Keyed on course **id**, so renaming a course doesn't reshuffle; anything unlisted keeps its filename order at the end.
- `buildProgressFiles(data)` / `parseProgressFiles(files)` — **pure**, manifest + one file per course and back. Parsing skips the manifest rather than reporting it as a bad file, and a folder without one still loads (alphabetically, semesters derived from the courses).
- `saveProgressToServer` / `loadProgressFromServer` — `PUT`/`GET` on `/api/progress`. Throw `ProgressApiUnavailableError` when nothing is listening *or* the response isn't JSON (a static host answers the SPA fallback with HTML, so a 200 alone proves nothing).
- `buildProgressJson` / `parseProgressJson` — each course file holds the same `{ version, courses }` envelope as `localStorage` with one course, so `migrate` opens old files. `semesters` is written only when passed, which is the single-file fallback's case.
- `saveProgressAsSingleFile` — the no-server fallback; carries the semesters itself and keeps order by being one array, so it needs no manifest.

**Server — [vite-plugin-progress-files.ts](vite-plugin-progress-files.ts)**
- A Vite plugin adding `GET`/`PUT /api/progress`, attached to both the dev and preview servers. The browser can't touch the filesystem; the Node process behind it can.
- `isSafeProgressFileName` / `resolveProgressPath` — the security boundary. Filenames arrive from the page, so traversal (`../../.bashrc`) must be rejected; both a name check and a resolved-path check apply. Unicode is allowed since course titles aren't always English.
- `writeProgressFiles` makes the folder **match the payload exactly**: it writes the incoming files and prunes every other `.json`. Saving zero courses leaves only the manifest, which is why the client has no "nothing to save" guard. Non-JSON files are never touched.

⚠️ The API only exists while a Vite server runs. `npm run build` output served elsewhere has no Node process, so the client degrades to a download and a manual file picker.

⚠️ `progresses/` is gitignored — it's personal data, not source.

## Components — `src/components/`

Presentational; state arrives as props. None read the store.

- [CourseSection.tsx](src/components/CourseSection.tsx) (133) — one course. Gates the final grade on `areWeightsValid`; owns its own `AddBreakdownDialog` instance.
- [BreakdownCard.tsx](src/components/BreakdownCard.tsx) (133) — one breakdown. Local UI state: `isOpen`, `showAdvanced`.
- [SubBreakdownRow.tsx](src/components/SubBreakdownRow.tsx) (80) — name, `achieved / full` mark inputs, and the row's own percentage.
- [AdvancedOptions.tsx](src/components/AdvancedOptions.tsx) — four switches as a **controlled field group** over a `PolicyDraft`. Drop/downweight disable each other; Full Credit and Bonus Grade deliberately do not. **Stateless** — every box is raw text on the draft, so a field can be emptied and retyped; the parents reject blanks on submit. No help tooltips — they never worked and were removed. Used by both dialogs; holds no rules of its own.
- [AdvancedOptionsDialog.tsx](src/components/AdvancedOptionsDialog.tsx) — modal wrapper with Cancel/Apply. Draft state lives in an inner component `key`ed on `open`, so it re-seeds on every open (see the comment there — two subtler approaches were both wrong). Apply refuses a draft with an empty box and shows which field.
- [ConfirmDeleteDialog.tsx](src/components/ConfirmDeleteDialog.tsx) — **every** delete goes through this: sub-breakdown, breakdown, course, semester. Stateless and domain-free — title, description, confirm label. The component owning the trash button owns the open flag and writes the description, so each one names what else is about to go.
- [NewCourseDialog.tsx](src/components/NewCourseDialog.tsx) (74) — prompts for a course name; Add disabled while blank.
- [SemesterPanel.tsx](src/components/SemesterPanel.tsx) — left panel: Add Semester button plus the semester list with course counts; selecting one filters the course view. Rows show `shortSemesterLabel` with a tooltip carrying the full name and course count, and the same full name as `aria-label`. Each row is a container, not a single button, since the delete control is itself a button and buttons can't nest; it stays hidden until hover or focus. Owns the semester delete confirmation.
- [AddSemesterDialog.tsx](src/components/AddSemesterDialog.tsx) — year and term dropdowns producing a semester label.
- [AddBreakdownDialog.tsx](src/components/AddBreakdownDialog.tsx) — preset picker + "Others (Specify)" free text + weight + a collapsed advanced-options section, in a `<form>` so Return submits. Caps the dropdown with `max-h-56`.
- [NumberInput.tsx](src/components/NumberInput.tsx) (26) — `<Input type="number">` that blurs on wheel so scrolling can't rewrite a mark. **Use this for every numeric field.**
- [GradeDisplay.tsx](src/components/GradeDisplay.tsx) — the only grade-rendering surface. With `showLetterGrade` it renders the official chain `79.60 → 80 : A-` and takes its colour from the rounded value.
- [CourseToolbar.tsx](src/components/CourseToolbar.tsx) — header **Reload Progress** / **Save Progress** / **New Course** actions and their toasts.

## Pages & hooks

- [src/pages/Index.tsx](src/pages/Index.tsx) — owns the store, header, empty state, `NewCourseDialog`, and the horizontal snap carousel. Takes `{ storage, user }` from the gate. Renders `FullPageLoader` while loading and a retry screen on `loadError` (editing on top of a failed read would save an empty tree over the account). Toasts `saveError`. Hosts `AccountMenu` and `ImportLocalDataDialog`.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) (24) — 404.
- [src/hooks/useProgressFile.ts](src/hooks/useProgressFile.ts) — owns both **Save Progress** and **Reload Progress**: calls the local API, falls back on `ProgressApiUnavailableError`, and reports outcomes. Holds the hidden multi-file input used by the fallback.
- [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) — 768px hook; used only by `ui/sidebar`.
- [src/hooks/use-toast.ts](src/hooks/use-toast.ts) — shadcn toast reducer; app code uses `sonner` instead.
- [src/lib/utils.ts](src/lib/utils.ts) — `cn()`, `clamp(value, min, max)` and `plural(count, noun)` (`1 course` / `3 courses`, used by the delete dialogs and the progress toasts).

## UI kit — `src/components/ui/` (48 files)

shadcn/ui over Radix. **Vendored — do not hand-edit**; re-add via CLI.
⚠️ One deliberate local fix: [select.tsx](src/components/ui/select.tsx) caps `SelectContent`/Viewport to `--radix-select-content-available-height` and lets the viewport scroll. Upstream's fixed viewport height let long option lists run off screen. Re-running `shadcn add select` reverts it.
14 are imported by app code (`alert`, `button`, `card`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `sonner`, `switch`, `toast`, `toaster`, `tooltip`), 4 more only by other `ui/` files, and **30 are unused**.
→ Per-file explanations, plus `public/`, in [UI_GUIDE.md](UI_GUIDE.md).

## Styling

- [src/index.css](src/index.css) — Tailwind layers, Google Fonts import, all HSL vars for `:root` and `.dark` including `--grade-*`, the `.grade-display` utility, and the rule hiding number-input spinner arrows.
- [tailwind.config.ts](tailwind.config.ts) — maps vars to tokens; `fade-in`/`scale-in`; `darkMode: ["class"]`.
- ⚠️ `next-themes` is installed but no provider is mounted — **dark mode is unreachable**.

## Tests — `src/test/`, 378 across 13 files

New: [auth](src/test/auth.test.ts) (`validateCredentials`, `describeAuthError`) · [supabaseCourseStorage](src/test/supabaseCourseStorage.test.ts) (row round trip, missing row, older schema, unreadable row) · [debouncedStorage](src/test/debouncedStorage.test.ts) (coalescing, waiter settlement, flush/cancel, mid-flight saves — uses fake timers).

⚠️ `useGradeStore.test.ts` builds its storage **outside** the `renderHook` callback and awaits a `settle()` helper. Building it inline would hand the store a new object every render and reload in a loop. `settle()` drains microtasks inside `act` in place of `waitFor` — see below.

⚠️ `@testing-library/dom` is a required peer of RTL 16 and was **missing**, so `useGradeStore.test.ts` couldn't be imported at all and its tests never ran. Now a devDependency.

All tests live here, one file per module, importing via `@/lib/...`:
[gradeCalculations](src/test/gradeCalculations.test.ts) · [gradePolicies](src/test/gradePolicies.test.ts) · [gradeFormatting](src/test/gradeFormatting.test.ts) · [breakdownPresets](src/test/breakdownPresets.test.ts) · [courseStorage](src/test/courseStorage.test.ts) (v1 migration) · [progressFile](src/test/progressFile.test.ts) (save/reload round trip, bad input, older files) · [useGradeStore](src/test/useGradeStore.test.ts) (hook driven via `renderHook` with in-memory storage; semester lifecycle and import).
[utils](src/test/utils.test.ts) covers `clamp` and `plural`. [setup.ts](src/test/setup.ts) provides `jest-dom` + a `matchMedia` stub. Untested: React components (the store hook is now covered).

## Build & config

- **Env** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored by `*.local`), typed in [src/vite-env.d.ts](src/vite-env.d.ts), template in [.env.example](.env.example). Read **only** by `src/lib/supabase.ts`. Vite reads env files at startup — restart after editing.
- ⚠️ `npm i` fails `ERESOLVE` (`@vitejs/plugin-react-swc` peers `vite ≤7`, project runs vite 8). Use `npm i --legacy-peer-deps`.
- [vite.config.ts](vite.config.ts) — port **8080**, registers `progressFilesPlugin()`, `open: true` (launches the OS default browser on `npm run dev`; `BROWSER=none` suppresses it), `@` → `./src`, `lovable-tagger` in dev only.
- [vitest.config.ts](vitest.config.ts) — jsdom, globals on.
- [.claude/launch.json](.claude/launch.json) — dev-server config for tooling.
- [tsconfig.app.json](tsconfig.app.json) — ⚠️ `strict: false`. Types are advisory.
- Lockfiles: both `bun.lock` and `package-lock.json` exist. ⚠️ Pick one.
