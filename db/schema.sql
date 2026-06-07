-- afterparty.digital — Neon (plain Postgres) schema.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql  (or `npm run db:setup`)
--
-- Differs from the old Supabase schema: no `auth.users` FK and no RLS — on Neon
-- you connect as the owner over a single connection string, so access control
-- is enforced in the app (page_token bearer checks in server actions), not RLS.
-- gen_random_uuid() is built into Postgres core (no extension needed).

create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  organizer_id uuid,
  event_date   date,
  dissolves_at timestamptz,
  status       text not null default 'draft'
                 check (status in ('draft', 'processing', 'live', 'dissolved')),
  created_at   timestamptz not null default now()
);

create table if not exists attendees (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  name        text not null,
  title       text,
  company     text,
  bio         text,
  interests   text[] not null default '{}',
  socials     jsonb  not null default '{}'::jsonb,
  page_token  text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists connections (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events (id) on delete cascade,
  source_attendee_id uuid not null references attendees (id) on delete cascade,
  target_attendee_id uuid not null references attendees (id) on delete cascade,
  kind               text not null default 'recommended'
                       check (kind in ('recommended', 'marked', 'confirmed')),
  reason             text,
  note               text,
  created_at         timestamptz not null default now(),
  unique (source_attendee_id, target_attendee_id, kind)
);

create table if not exists clusters (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events (id) on delete cascade,
  label        text not null,
  theme        text,
  attendee_ids uuid[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table if not exists highlights (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events (id) on delete cascade,
  title      text not null,
  body       text,
  source     text,
  created_at timestamptz not null default now()
);

create index if not exists attendees_event_id_idx   on attendees (event_id);
create index if not exists attendees_page_token_idx on attendees (page_token);
create index if not exists connections_event_id_idx on connections (event_id);
create index if not exists connections_source_idx   on connections (source_attendee_id);
create index if not exists clusters_event_id_idx    on clusters (event_id);
create index if not exists highlights_event_id_idx  on highlights (event_id);
