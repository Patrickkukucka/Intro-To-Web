-- ============================================================
-- BirdDex Supabase Schema
-- Run this in the Supabase SQL editor to set up your database.
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now() not null,
  streak_count int default 0 not null,
  last_active_date date,
  is_pro boolean default false not null,
  country_code char(2),
  region text
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- BIRDS (master species list from eBird)
-- ============================================================
create table if not exists public.birds (
  id text primary key,              -- eBird species code (e.g. "amecro")
  common_name text not null,
  scientific_name text not null,
  family text,
  bird_order text,
  rarity text default 'Common' not null
    check (rarity in ('Common', 'Uncommon', 'Rare', 'Legendary')),
  thumbnail_url text,
  fun_facts text[],
  observation_count int default 0
);

-- ============================================================
-- SIGHTINGS
-- ============================================================
create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  bird_id text references public.birds(id) not null,
  photo_url text,
  notes text,
  latitude double precision,
  longitude double precision,
  location_name text,
  spotted_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create index if not exists sightings_user_id_idx on public.sightings(user_id);
create index if not exists sightings_spotted_at_idx on public.sightings(spotted_at desc);
create index if not exists sightings_bird_id_idx on public.sightings(bird_id);

-- ============================================================
-- USER_BIRDS (collection — one row per user+species)
-- ============================================================
create table if not exists public.user_birds (
  user_id uuid references public.profiles(id) on delete cascade not null,
  bird_id text references public.birds(id) not null,
  times_seen int default 1 not null,
  first_seen_at timestamptz default now() not null,
  last_seen_at timestamptz default now() not null,
  first_photo_url text,
  primary key (user_id, bird_id)
);

create index if not exists user_birds_user_id_idx on public.user_birds(user_id);

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================
create or replace view public.leaderboard as
select
  p.id,
  p.username,
  p.avatar_url,
  p.country_code,
  p.is_pro,
  count(distinct ub.bird_id)::int as total_birds,
  (
    select b.rarity
    from public.user_birds ub2
    join public.birds b on b.id = ub2.bird_id
    where ub2.user_id = p.id
    order by
      case b.rarity
        when 'Legendary' then 4
        when 'Rare' then 3
        when 'Uncommon' then 2
        else 1
      end desc
    limit 1
  ) as rarest_rarity,
  (
    select b.common_name
    from public.user_birds ub2
    join public.birds b on b.id = ub2.bird_id
    where ub2.user_id = p.id
    order by
      case b.rarity
        when 'Legendary' then 4
        when 'Rare' then 3
        when 'Uncommon' then 2
        else 1
      end desc
    limit 1
  ) as rarest_common_name
from public.profiles p
left join public.user_birds ub on ub.user_id = p.id
group by p.id, p.username, p.avatar_url, p.country_code, p.is_pro
order by total_birds desc;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sightings enable row level security;
alter table public.user_birds enable row level security;

-- Profiles: anyone can read, only owner can write
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Sightings: only owner can read/write
create policy "sightings_select" on public.sightings for select using (auth.uid() = user_id);
create policy "sightings_insert" on public.sightings for insert with check (auth.uid() = user_id);
create policy "sightings_update" on public.sightings for update using (auth.uid() = user_id);
create policy "sightings_delete" on public.sightings for delete using (auth.uid() = user_id);

-- User birds: only owner can read/write
create policy "user_birds_select" on public.user_birds for select using (auth.uid() = user_id);
create policy "user_birds_insert" on public.user_birds for insert with check (auth.uid() = user_id);
create policy "user_birds_update" on public.user_birds for update using (auth.uid() = user_id);

-- Birds master list: anyone can read (no RLS needed, service role manages writes)
alter table public.birds enable row level security;
create policy "birds_select" on public.birds for select using (true);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Run in Supabase Storage settings or via the dashboard:
-- Bucket name: bird-photos
-- Public: true (so photo URLs work without auth headers)

insert into storage.buckets (id, name, public)
values ('bird-photos', 'bird-photos', true)
on conflict (id) do nothing;

create policy "bird_photos_select" on storage.objects
  for select using (bucket_id = 'bird-photos');

create policy "bird_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'bird-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- SAMPLE BIRDS (optional seed data for testing)
-- ============================================================
insert into public.birds (id, common_name, scientific_name, family, bird_order, rarity, observation_count)
values
  ('amecro', 'American Crow', 'Corvus brachyrhynchos', 'Corvidae', 'Passeriformes', 'Common', 5000000),
  ('mallar3', 'Mallard', 'Anas platyrhynchos', 'Anatidae', 'Anseriformes', 'Common', 8000000),
  ('norcar', 'Northern Cardinal', 'Cardinalis cardinalis', 'Cardinalidae', 'Passeriformes', 'Common', 6000000),
  ('amegfi', 'American Goldfinch', 'Spinus tristis', 'Fringillidae', 'Passeriformes', 'Common', 4000000),
  ('blujay', 'Blue Jay', 'Cyanocitta cristata', 'Corvidae', 'Passeriformes', 'Common', 3500000),
  ('dowwoo', 'Downy Woodpecker', 'Dryobates pubescens', 'Picidae', 'Piciformes', 'Uncommon', 3000000),
  ('baleag', 'Bald Eagle', 'Haliaeetus leucocephalus', 'Accipitridae', 'Accipitriformes', 'Uncommon', 800000),
  ('pilgri', 'Peregrine Falcon', 'Falco peregrinus', 'Falconidae', 'Falconiformes', 'Rare', 250000),
  ('whocrn', 'Whooping Crane', 'Grus americana', 'Gruidae', 'Gruiformes', 'Legendary', 5000),
  ('calcon', 'California Condor', 'Gymnogyps californianus', 'Cathartidae', 'Cathartiformes', 'Legendary', 2000)
on conflict (id) do nothing;
