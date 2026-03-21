-- ============================================================
-- Supabase Migration V2: Players table + onboarded flag
-- Run this in Supabase SQL Editor AFTER the initial migration
-- ============================================================

-- 1. Add onboarded flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean default false;

-- 2. Create players table
create table public.players (
  id bigint generated always as identity primary key,
  club text not null,
  name text not null,
  ghin text default '',
  course_hdcp numeric(4,1) default 15.0,
  index numeric(4,1) default 15.0,
  phone text default '',
  email text default '',
  status text not null default 'not_contacted' check (status in ('not_contacted', 'contacted', 'confirmed', 'declined', 'maybe')),
  contact_owner text default '',
  contact_date text default '',
  availability_1 text default 'no' check (availability_1 in ('yes', 'no', 'maybe')),
  availability_2 text default 'no' check (availability_2 in ('yes', 'no', 'maybe')),
  availability_3 text default 'no' check (availability_3 in ('yes', 'no', 'maybe')),
  loc_pref_1 text default '',
  loc_pref_2 text default '',
  loc_pref_3 text default '',
  notes text default '',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Enable RLS on players
alter table public.players enable row level security;

-- 4. RLS Policies for players
-- Users can read players from their own club
create policy "Users can view players from their club"
  on public.players for select
  to authenticated
  using (
    club = (select club from public.profiles where id = auth.uid())
  );

-- Admins and captains can insert players for their club
create policy "Admins and captains can insert players"
  on public.players for insert
  to authenticated
  with check (
    club = (select club from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'captain')
    )
  );

-- Admins and captains can update players in their club
create policy "Admins and captains can update players"
  on public.players for update
  to authenticated
  using (
    club = (select club from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'captain')
    )
  );

-- Admins can delete players in their club
create policy "Admins can delete players"
  on public.players for delete
  to authenticated
  using (
    club = (select club from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'captain')
    )
  );

-- 5. Update the trigger to include onboarded flag
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, club, onboarded)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'vice_captain'),
    coalesce(new.raw_user_meta_data ->> 'club', ''),
    false
  );
  return new;
end;
$$;
