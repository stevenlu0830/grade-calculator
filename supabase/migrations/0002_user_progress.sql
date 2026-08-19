-- One saved snapshot of grade data per account — what Save Progress writes and
-- Reload Progress reads back.
--
-- Deliberately a *different* table from `user_data`, not a second column on it.
-- `user_data` is the live autosave: the store writes to it after every edit, so
-- if Save Progress wrote there too, Reload Progress would only ever hand back
-- what is already on screen and the pair of buttons would do nothing. A
-- snapshot is only useful while it can differ from the live tree.
--
-- `data` holds the same `{ version, courses, semesters }` envelope `user_data`
-- holds, so both share `migrate()` in src/lib/courseStorage.ts and a snapshot
-- taken by an older build still opens.
--
-- Run this once, in the Supabase dashboard's SQL Editor.

create table if not exists public.user_progress (
  user_id  uuid        primary key references auth.users (id) on delete cascade,
  version  integer     not null,
  data     jsonb       not null,
  -- Read back on reload and shown in the toast, so the student can tell which
  -- copy they are about to restore.
  saved_at timestamptz not null default now()
);

-- Same story as `user_data`: the anon key ships in the browser bundle, so these
-- policies are the entire access control story. Without them any visitor could
-- read every account's saved snapshot.
alter table public.user_progress enable row level security;

-- Separate policies per operation rather than one `for all`, so the intent of
-- each is readable and an accidental widening of one doesn't widen the rest.
-- `using` gates which existing rows are visible; `with check` gates what a row
-- is allowed to become, which is what stops a write aimed at someone else's id.
drop policy if exists "Users read their own progress" on public.user_progress;
create policy "Users read their own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert their own progress" on public.user_progress;
create policy "Users insert their own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own progress" on public.user_progress;
create policy "Users update their own progress"
  on public.user_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own progress" on public.user_progress;
create policy "Users delete their own progress"
  on public.user_progress for delete
  using (auth.uid() = user_id);

-- Keeps `saved_at` honest without the client having to send it. Saving is an
-- upsert, so the second and every later save take the update path — without
-- this trigger they would keep reporting the time of the very first save.
create or replace function public.touch_user_progress_saved_at()
returns trigger
language plpgsql
as $$
begin
  new.saved_at = now();
  return new;
end;
$$;

drop trigger if exists user_progress_set_saved_at on public.user_progress;
create trigger user_progress_set_saved_at
  before update on public.user_progress
  for each row execute function public.touch_user_progress_saved_at();
