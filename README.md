# UBC Grade Calculator

Work out what you're actually sitting on in a course — and what you still need — as you enter each mark.

You build a course the way your syllabus describes it: a list of weighted categories (**breakdowns**) like "Assignments 30%", each holding the individual items (**sub-breakdowns**) you're graded on. Type in the marks you've been given, out of whatever they were marked out of, and the breakdown grades, their weighted contributions, and your final percentage and letter grade all update as you type. Courses are grouped by semester, blank marks are left out instead of counted as zero, and nothing is uploaded anywhere except your own account.

> Looking for the code, the architecture, or the data format? That's [TECHNICAL_README.md](TECHNICAL_README.md).

---

## Contents

- [Running the app](#running-the-app)
- [Signing in](#signing-in)
- [The screen at a glance](#the-screen-at-a-glance)
- [Features, and how to use them](#features-and-how-to-use-them)
  - [Add a semester](#add-a-semester)
  - [Switch between semesters](#switch-between-semesters)
  - [Add a course](#add-a-course)
  - [Add a breakdown](#add-a-breakdown)
  - [Enter your marks](#enter-your-marks)
  - [Add more items to a breakdown](#add-more-items-to-a-breakdown)
  - [Change what an item is marked out of](#change-what-an-item-is-marked-out-of)
  - [Read the grades](#read-the-grades)
  - [Advanced options: drop lowest, downweight, equal weight, full credit, bonus](#advanced-options)
  - [Tidy up a long course](#tidy-up-a-long-course)
  - [Delete a row, a breakdown, a course, a semester](#delete-things)
  - [Save and reload your progress](#save-and-reload-your-progress)
  - [Sign out](#sign-out)
- [Grade colours and letters](#grade-colours-and-letters)
- [Common questions](#common-questions)

---

## Running the app

You need [Node.js](https://nodejs.org) 20 or newer and a free [Supabase](https://supabase.com) project (that's where your grades are stored, and sign-in won't work without it).

```bash
npm install --legacy-peer-deps
```

Set up the database once:

1. Create a project at [supabase.com](https://supabase.com) — the free tier is plenty.
2. In your project's **SQL Editor**, paste and run the contents of `supabase/migrations/0001_user_data.sql`, then `supabase/migrations/0002_user_progress.sql`. Between them those create the two tables your grades live in — the one autosaved as you type, and the one **Save Progress** writes to — and the security rules that keep both yours.
3. Copy `.env.example` to `.env.local` and fill in the two values from **Project Settings → API**:
   ```sh
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Decide how registration works, under **Authentication → Sign In / Providers → Confirm email**. Leave it **on** and new accounts get an email with a link they have to click first. Turn it **off** and registering signs you straight in, which is easier while you're just poking at it locally. The app handles both.
5. If you left confirmation on, add the addresses the app runs at to **Authentication → URL Configuration → Redirect URLs** — at least `http://localhost:8080` plus wherever you deploy it. Links to an address that isn't listed get dropped, which looks like the email is broken.

If you forked this on GitHub, do one more step. Supabase pauses a free project after 7 days with no activity, and this repo has a scheduled job that pings it twice a week to stop that. It needs its own copy of the two values, because secrets aren't carried over to a fork: go to **Settings → Secrets and variables → Actions** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY` — the same values as above, but without the `VITE_` prefix. Skip this and you'll get a failed-job email every Monday and Thursday.

Then start it:

```bash
npm run dev
```

The app opens at **http://localhost:8080**.

If the app shows a "Supabase isn't configured yet" screen, either `.env.local` is missing a value or the dev server was started before you wrote the file — stop it and run `npm run dev` again.

<details>
<summary>Other commands</summary>

```bash
npm run build   # production build into dist/
npm run lint    # lint the source
npm test        # run the test suite
```
</details>

## Signing in

Grades are tied to an account, so nobody else using the same computer sees yours.

1. Enter your email and a password (at least 6 characters).
2. First time here? Click **Register** next to "Need an account?", confirm the password, and press **Create account**.
3. Coming back? Press **Sign in**.

If you used this app before it had accounts, it offers to bring those courses across the first time you sign in — press **Import** on the "Bring your saved courses over?" dialog. The offer appears once, and only when your account is still empty.

## The screen at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  UBC Grade Calculator      Reload Progress  Save Progress  New Course │  ← header
├──────────────┬───────────────────────────────────────────────────────┤
│ Add Semester │  ┌── CPSC 320 ─── FINAL GRADE 78.80 → 79 : B+ ──┐     │
│ 2026W1    3  │  │  Assignments  40 %   81.25   W: 32.50        │  ↔  │  ← courses
│ 2025W2    5  │  │    Assignment 1    8 / 10    80.00%          │     │     scroll
│ 2025S1    0  │  │    Assignment 2   17 / 20    85.00%          │     │     sideways
└──────────────┴───────────────────────────────────────────────────────┘
     ↑ semesters, with how many courses are in each
```

- The **left panel** lists your semesters. Clicking one shows its courses.
- The **courses panel** holds one card per course, side by side. Scroll down inside a card to reach the rest of a long course; the course name and final grade stay pinned to the top of the panel while you do, so you can watch the final grade move as you type. Scroll sideways to reach your other courses.

## Features, and how to use them

### Add a semester

Courses have to live in a semester, so this comes first.

1. Press **Add Semester** at the top of the left panel.
2. Pick a **Year** and a **Term** (Winter Term 1, Winter Term 2, Summer Term 1, Summer Term 2).
3. Press **Add**.

The new semester appears in the panel and is selected for you. Semesters are listed most recent first, and shown abbreviated — `2026W1` is 2026 Winter Term 1. Hover a row to see the full name and its course count.

### Switch between semesters

Click any semester in the left panel. The courses panel switches to that semester's courses, and the number on the right of each row tells you how many courses are in it before you click.

### Add a course

1. Select the semester it belongs to.
2. Press **New Course** in the header.
3. Type the course name — e.g. `CPSC 121` — and press **Add course**.

To rename a course later, click its name at the top of its card and type. There's no save button; edits are kept as you make them.

If **New Course** tells you to "Add a semester first", nothing is selected on the left yet.

### Add a breakdown

A breakdown is one weighted line of your syllabus: "Assignments 30%", "Final Exam 45%".

1. Press **Add Breakdown** at the bottom of the course card (or in the middle of an empty one).
2. Choose what it is from the **Breakdown** dropdown — Assignments, Essay, Final Exam, iClickers, In-class Exercises, Labs, Midterms, Participation, Project Phases, Quizzes, Research Paper, Tests, Tutorials, WebWorks, or **Others (Specify)** to type your own name.
3. Enter its **Weighting (%)** — the number from your syllabus.
4. Optionally open **Advanced options** to set a grading rule now (you can also do it later — see [Advanced options](#advanced-options)).
5. Press **Add**.

The breakdown arrives with one empty row ready for a mark. Its weight and name stay editable in the card header afterwards.

**The weights have to total 100%.** Until they do, the course shows `—` instead of a final grade, with a warning saying what your weights currently add up to — handy for spotting the breakdown you forgot.

### Enter your marks

Each row under a breakdown is one graded item, with two boxes: what you scored, and what it was out of.

1. Click the left box and type the marks you got — `17`.
2. Click the right box and type what it was out of — `20`.

The row's percentage appears on the right, and the breakdown and course grades update immediately.

- **Leave a row blank until it's marked.** An unmarked row is ignored completely — it is *not* counted as a zero, and it doesn't drag your grade down while you wait for a mark.
- **A real zero counts.** Type `0` for something you actually scored nothing on.
- **Bonus marks are allowed.** `22 / 20` is accepted as-is and can push a breakdown over 100%; the app never "corrects" a mark you typed.
- Rename a row by clicking its name — useful for `Quiz 3 (dropped)` or `Essay draft`.

### Add more items to a breakdown

Press **Add Sub-breakdown** under the breakdown. New rows are named for you — `Assignment 1`, `Assignment 2`, … — continuing past the highest number already used, so deleting one doesn't create a duplicate name.

### Change what an item is marked out of

Sometimes a course re-marks an item out of a different total: your 8/10 quiz becomes a quiz out of 30. Typing over the "out of" box would quietly turn your 8/10 into 8/30 — a much worse grade — so re-marking has its own button.

1. Press the **scales** button (⚖) on the right of the row. Hover it and it says *Change full mark*.
2. Type the **New full mark**.
3. Check the preview — `8 / 10 (80.00%) becomes 24 / 30`.
4. Press **Apply**.

Your percentage on that item is unchanged; both boxes move together. (If the row has no mark yet, only the "out of" changes.)

### Read the grades

Each breakdown header shows three things:

| What you see | What it means |
|---|---|
| `40 %` | The breakdown's weight in the course — you type this one |
| `81.25` | The breakdown's own grade: all the marks you got, over all the marks available in it |
| `W: 32.50` | What it contributes to your final grade — 81.25% of the 40 points it's worth. Hover for the full label |

And at the top of the course card:

```
FINAL GRADE   78.80 → 79 : B+
```

- **78.80** — your exact percentage.
- **79** — the whole number the course would be recorded with, rounded from it.
- **B+** — the letter that number earns.

Only the recorded grade and its letter are coloured, because that's the grade that counts. The exact figure is there to explain where it came from. Numbers are shown to two decimal places, but every calculation uses the full unrounded value — which is why a column of them can read as 99.99 rather than 100.

### Advanced options

Real syllabi have rules, and these are them. Press **Advanced** at the bottom right of a breakdown, set what you need, and press **Apply** — nothing changes until you do, so **Cancel** really does discard. Whatever is active is summarised in small text beside the button, so you can see it at a glance.

**Drop Lowest** — "your lowest two quizzes don't count".
Switch it on, enter how many to drop. The worst-scoring items are excluded, ranked by percentage, and their marks leave the total entirely — dropping a 0/20 removes those 20 marks from what you're being measured out of. At least one item always survives, and a breakdown with a single mark can't drop anything.

**Downweight** — "your worst lab counts for half".
Switch it on, enter how many items and by what percentage to reduce them. The worst items shrink on both sides — a 4/10 downweighted by 50% counts as 2/5 — so they pull less rather than distorting the result.

**Equal Weight** — "each assignment is worth the same, whatever it's marked out of".
Normally a bigger item counts for more: an 18/20 outweighs a 4/5, because that's what "Assignments 30%" usually means. Switch **Equal Weight** on when your syllabus instead says each item is worth the same slice, even though they're marked out of different totals. Every item is then treated as its own percentage: 8/10 and 40/50 both count as 80%, and your breakdown grade becomes the plain average of the rows.

It combines with everything above — Drop Lowest still drops your worst *score*, and after equalising each dropped item takes exactly its equal share out with it.

**Full Credit** — "80% on the iClickers earns you the full marks".
Switch it on and enter that threshold. Your grade for the breakdown is scaled so the threshold reads as 100%: with a threshold of 80, a raw 60% becomes 75%, and anything at or above 80% is full credit. Note that this caps the breakdown at 100%, so bonus marks stop showing above it.

**Bonus Grade** — for a breakdown that's extra credit.
Its weight is added *on top* of the course instead of counted inside the 100%, so your other breakdowns still have to total 100 on their own. A 2% bonus you aced can push a final grade to 102. The breakdown header shows a **Bonus** tag, and the course notes how much extra credit is available.

Drop Lowest and Downweight are alternatives — switching one on disables the other. Equal Weight, Full Credit and Bonus combine with either. If **Apply** doesn't seem to do anything, an option you switched on has an empty box; the dialog says which.

### Tidy up a long course

Press the **chevron** (⌄) to the left of a breakdown's name to collapse it. Its header — weight, grade, contribution — stays visible, so you can fold away the breakdowns you've finished entering and keep the ones you're working on open.

### Delete things

Every trash button asks first, and tells you what else goes with it. There is **no undo**, so the confirmation is the only safety net.

- **A row** — the trash button at the end of it. A breakdown always keeps at least one row, so the last one can't be deleted.
- **A breakdown** — the trash button in its header. Takes its rows and their marks.
- **A course** — the trash button at the top right of the card. Takes its breakdowns.
- **A semester** — hover its row in the left panel and press the trash button. **Takes every course in it.**

### Save and reload your progress

Your grades save to your account automatically as you type — you don't have to do anything, and they'll be there on your next sign-in, on any computer.

**Save Progress** does something extra: it keeps a separate **saved copy** of everything, in your account alongside the automatic one. Think of it as a checkpoint — somewhere to get back to if you spend an afternoon experimenting with "what if I bomb the final" and want your real numbers back.

1. Press **Save Progress** in the header.
2. A toast confirms how many courses were saved — `3 Courses Saved`.

**Reload Progress** brings that copy back.

1. Press **Reload Progress** in the header.
2. A toast confirms how many courses came back, and when that copy was saved.

⚠️ **Reloading replaces what's on screen — it doesn't merge.** Anything you've added since the last save is gone.

Saving replaces the whole checkpoint at once, so courses you've deleted are gone from it too and a reload can't resurrect them. And because the copy lives in your account rather than on one machine, you can save on your laptop and reload on a lab computer.

If you press **Reload Progress** before you've ever pressed **Save Progress**, nothing happens except a toast telling you so — it won't wipe what you have.

### Sign out

Press the **person** button at the top right, then **Sign out**. It shows which account you're signed in as, in case you're not sure.

## Grade colours and letters

The letter grade follows the **recorded** grade — the whole number your percentage rounds to. A 79.6 is recorded as 80, which is an A-, not a B+.

| Letter | Percentage | Colour |
|---|---|---|
| A+ | 90 and up | green |
| A | 85 – 89 | green |
| A- | 80 – 84 | green-yellow |
| B+ | 76 – 79 | yellow |
| B | 72 – 75 | yellow |
| B- | 68 – 71 | yellow |
| C+ | 64 – 67 | golden |
| C | 60 – 63 | golden |
| C- | 55 – 59 | golden |
| D | 50 – 54 | orange |
| F | below 50 | red |

Letters in the same family share a colour, so the colour tells you roughly where you are and the letter tells you exactly. The greens and yellows are deep rather than fluorescent — bright yellow on a white card is unreadable.

## Common questions

**My final grade shows `—`.**
Your breakdown weights don't total 100%. The warning on the card shows what they currently add up to. A breakdown marked **Bonus** doesn't count towards the 100%, which is the usual surprise.

**A breakdown grade isn't the average of the row percentages.**
That's the default and it's deliberate: your marks are added up and divided by the marks available, so a 45/50 test counts for five times as much as a 9/10 quiz — which is what most syllabi mean. If yours really does weight every item equally, switch **Equal Weight** on in **Advanced**.

**A row shows a percentage but doesn't change my grade.**
Its "out of" is `0`, or still blank. Either way there's nothing to divide by, so the row is skipped.

**The letter grade doesn't match the percentage I see.**
The letter follows the rounded grade, shown right next to it: `79.60 → 80 : A-`.

**My grade went over 100%.**
Bonus marks (a 22/20) and bonus breakdowns both do that, on purpose. Nothing is clamped.

**A mark changed by itself.**
Something used **Change full mark**, which scales the score to keep its percentage. Typing directly in the boxes never does that.

**A semester I made is gone.**
Semesters with no courses are saved on their own list, so an empty one survives a **Reload Progress** as long as it existed when you pressed **Save Progress**. Deleting a semester also deletes its courses, and that can't be undone.

**Who can see my grades?**
Only you. Both copies — the automatic one and the one **Save Progress** writes — are stored in your own rows of your own Supabase project, protected by row-level security, and there's no analytics or third-party tracking in the app.
