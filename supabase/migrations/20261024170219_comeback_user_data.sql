create table if not exists public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_spaces (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  topic text not null default '',
  youtube_url text not null default '',
  notes text not null default '',
  recall text not null default '',
  next_step text not null default '',
  completed_steps text[] not null default '{}',
  focused_minutes integer not null default 0 check (focused_minutes >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.user_progress enable row level security;
alter table public.study_spaces enable row level security;

create policy "Users can read their own progress"
  on public.user_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own progress"
  on public.user_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own progress"
  on public.user_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read their own study spaces"
  on public.study_spaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own study spaces"
  on public.study_spaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own study spaces"
  on public.study_spaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own study spaces"
  on public.study_spaces for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update on public.user_progress to authenticated;
grant select, insert, update, delete on public.study_spaces to authenticated;
