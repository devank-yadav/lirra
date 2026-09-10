-- Create stories table to persist generated story sessions
create table if not exists public.stories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  child_name text,
  child_age smallint,
  child_language text,
  transcript text,
  story text,
  text_emotion text,
  text_emotion_confidence double precision,
  text_emotion_emoji text,
  voice_emotion text,
  recording_path text,
  story_audio_path text,
  provider text,
  created_at timestamptz default now()
);

alter table public.stories enable row level security;

create policy if not exists "stories_select_own"
  on public.stories
  for select
  using (auth.uid() = user_id);

create policy if not exists "stories_insert_own"
  on public.stories
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "stories_update_own"
  on public.stories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
