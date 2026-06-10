-- afterparty.digital — initial schema
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Honesty rule baked into the data model: a `connections.kind` is only ever
-- 'recommended' (AI), 'marked' (an attendee marked someone), or 'confirmed'
-- (the attendee confirmed it). There is no "they talked" / interaction edge,
-- because attendee-list-only data cannot support that claim.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  organizer_id uuid references auth.users (id) on delete set null,
  event_date   date,
  dissolves_at timestamptz,
  status       text not null default 'draft'
                 check (status in ('draft', 'processing', 'live', 'dissolved')),
  created_at   timestamptz not null default now()
);

create table if not exists public.attendees (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null,
  title       text,
  company     text,
  bio         text,
  interests   text[] not null default '{}',
  socials     jsonb  not null default '{}'::jsonb,
  page_token  text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.connections (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  source_attendee_id uuid not null references public.attendees (id) on delete cascade,
  target_attendee_id uuid not null references public.attendees (id) on delete cascade,
  kind               text not null default 'recommended'
                       check (kind in ('recommended', 'marked', 'confirmed')),
  reason             text,
  created_at         timestamptz not null default now(),
  unique (source_attendee_id, target_attendee_id, kind)
);

create table if not exists public.clusters (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  label        text not null,
  theme        text,
  attendee_ids uuid[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table if not exists public.highlights (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  title      text not null,
  body       text,
  source     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists attendees_event_id_idx     on public.attendees (event_id);
create index if not exists attendees_page_token_idx   on public.attendees (page_token);
create index if not exists connections_event_id_idx   on public.connections (event_id);
create index if not exists connections_source_idx     on public.connections (source_attendee_id);
create index if not exists clusters_event_id_idx      on public.clusters (event_id);
create index if not exists highlights_event_id_idx    on public.highlights (event_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Public attendee pages are served by the server using the service-role key
-- (which bypasses RLS) after validating the page_token, so no anonymous read
-- policy is needed. These policies only grant organizers access to the events
-- they own. With RLS enabled and no permissive anon policy, the anon key
-- cannot read or write anything directly.
-- ---------------------------------------------------------------------------

alter table public.events      enable row level security;
alter table public.attendees   enable row level security;
alter table public.connections enable row level security;
alter table public.clusters    enable row level security;
alter table public.highlights  enable row level security;

-- events: an organizer fully manages their own events
drop policy if exists "organizer manages own events" on public.events;
create policy "organizer manages own events" on public.events
  for all
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

-- child tables: an organizer reads rows belonging to events they own
drop policy if exists "organizer reads own attendees" on public.attendees;
create policy "organizer reads own attendees" on public.attendees
  for select
  using (event_id in (select id from public.events where organizer_id = (select auth.uid())));

drop policy if exists "organizer reads own connections" on public.connections;
create policy "organizer reads own connections" on public.connections
  for select
  using (event_id in (select id from public.events where organizer_id = (select auth.uid())));

drop policy if exists "organizer reads own clusters" on public.clusters;
create policy "organizer reads own clusters" on public.clusters
  for select
  using (event_id in (select id from public.events where organizer_id = (select auth.uid())));

drop policy if exists "organizer reads own highlights" on public.highlights;
create policy "organizer reads own highlights" on public.highlights
  for select
  using (event_id in (select id from public.events where organizer_id = (select auth.uid())));
