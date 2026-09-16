-- Cờ Vua Chiến Binh — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- One parent account (Supabase Auth, email + password) owns many kid profiles.
-- Each kid profile has a 4-digit PIN (hashed in the browser) and a jsonb bag of progress/settings.

create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 14),
  avatar      text not null default '🦁',
  pin_hash    text,                       -- sha256(profile salt + pin); null = no PIN
  data        jsonb not null default '{}'::jsonb,   -- { games, wins:{1,2,3}, losses, draws, lastLevel, settings:{...}, history:[...] }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Parents see and edit only their own kids.
drop policy if exists "own profiles" on public.profiles;
create policy "own profiles" on public.profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists profiles_user_idx on public.profiles (user_id, created_at);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
