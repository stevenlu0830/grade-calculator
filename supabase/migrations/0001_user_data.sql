-- One row of saved grade data per account.
--
-- The whole `GradeData` tree ({ courses, semesters }) lives in `data`, in
-- exactly the shape `localStorage` already held, so `migrate()` in
-- src/lib/courseStorage.ts opens a row from here the same way it opens a saved
-- browser payload. `version` mirrors SCHEMA_VERSION for the same reason.
--
-- Run this once, in the Supabase dashboard's SQL Editor.

create table if not exists public.user_data (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  version    integer     not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Row-level security is the entire access control story here. The anon key ships
-- in the browser bundle, so without these policies any visitor could read every
-- row. With them, Postgres itself refuses to return a row whose user_id isn't
-- the caller's.
alter table public.user_data enable row level security;

-- Separate policies per operation rather than one `for all`, so the intent of
-- each is readable and an accidental widening of one doesn't widen the rest.
-- `using` gates which existing rows are visible; `with check` gates what a row
-- is allowed to become, which is what stops a write aimed at someone else's id.
drop policy if exists "Users read their own data" on public.user_data;
create policy "Users read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert their own data" on public.user_data;
create policy "Users insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own data" on public.user_data;
create policy "Users update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own data" on public.user_data;
create policy "Users delete their own data"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- Keeps `updated_at` honest without the client having to remember to send it.
create or replace function public.touch_user_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_set_updated_at on public.user_data;
create trigger user_data_set_updated_at
  before update on public.user_data
  for each row execute function public.touch_user_data_updated_at();
