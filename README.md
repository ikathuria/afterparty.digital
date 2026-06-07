# afterparty.digital

> **Every event ends. The connections shouldn't.**

An AI-powered **post-event** platform. An organizer uploads an event's attendee
list, and every attendee gets a personal, time-limited "afterparty" page: who was
in their room, the specific people they should reach out to and *why*, a
copy-ready intro for each, and an editable connection graph that dissolves in 30
days. Organizers get a one-screen connection-ROI dashboard.

Built for the DeveloperWeek NY 2026 hackathon. See [`PLAN.md`](./PLAN.md) for the
full build log and [`SUBMISSION.md`](./SUBMISSION.md) for the project write-up.

## The honesty rule (the core design principle)

With only an attendee list there is **no interaction data**, so the product
*never* claims to know who met whom. It knows who was *present* and *recommends*
who's worth meeting. Every connection edge is `recommended`, `marked` (you added
them), or `confirmed` (you're following up) — never "they talked." This honesty
is the whole differentiator versus during-event networking apps.

## What's built

**Attendee page** (`/p/[token]`, an unguessable tokenized link)
- Vibrant hero: "here was your room," attendee count, your interest clusters
- **People you should meet** — top matches with a grounded reason each
- **Copy intro** — a ready-to-send, personalized outreach message per person
- **Editable relationship graph** — tap to open details, hover to trace links;
  confirm follow-ups, search-and-add anyone you missed
- **Private notes** per connection
- **Take it with you** — export your connections as a vCard before the page dies
- **30-day countdown**, framed as privacy-by-design

**Organizer dashboard** (`/dashboard/[eventId]`)
- ROI stats: attendees, connections mapped, avg intros/attendee, interest clusters
- The full room mapped as a force graph, communities separated and colored
- Clickable cluster legend + searchable attendee table

**Ingestion** (`/upload`) — robust CSV/JSON parser that maps messy real-world
headers (`Full Name`/first+last, `Job Title`/`Specialty`, social handles → URLs,
interest lists), then runs clustering + matchmaking automatically.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `src/`) · React 19 · TypeScript |
| Styling | Tailwind v4 · shadcn/ui · sonner |
| Database | **Neon** (serverless Postgres) via `@neondatabase/serverless`, raw SQL |
| AI core | Deterministic clustering + matchmaking (zero API calls); optional Anthropic Claude for interest enrichment |
| Graph viz | `react-force-graph-2d` |
| Hosting | Vercel; whole site password-gated via `src/proxy.ts` |

The matchmaking engine is **deterministic and key-free** — free, reproducible,
and it sends no attendee data to any third party. Claude is an *optional*
enhancement (interest inference), not a dependency.

## Local setup

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL (Neon pooled connection string)
npm run db:setup                  # apply db/schema.sql to your Neon database
npm run seed:demo                 # optional: seed a demo event from a local CSV
npm run dev                       # http://localhost:3000
```

- `npm test` — parser, clustering, and matchmaking unit tests
- `npm run db:setup` — apply [`db/schema.sql`](./db/schema.sql) (idempotent)
- Deployment + security model: [`DEPLOY.md`](./DEPLOY.md)

## Privacy & security model

- **Unguessable URLs** — attendee pages use 96-bit tokens; dashboards use the
  event UUID. No browsable directory of people exists.
- **Token-scoped writes** — every edit action validates the page token server-side.
- **Ephemeral by design** — events carry a `dissolves_at`; pages go dark after it.
- **Password gate** — set `SITE_PASSWORD` and the whole deployment sits behind
  HTTP Basic Auth (plus `noindex`), so non-public demo data is never exposed.
