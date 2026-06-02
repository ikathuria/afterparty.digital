# afterparty.digital

> "Every event ends. The connections shouldn't." — An AI-powered post-event platform that turns an event's attendee list into a personal, time-limited "afterparty" page for each attendee: who was in your room, the people you should reach out to and why, and an editable connection graph that dissolves in 30 days. Built solo in 9 days for the DeveloperWeek 2026 hackathon.

---

## Viability Summary

| | |
|---|---|
| **Market** | Crowded but mis-aimed — Brella, Grip, Swapcard, Remo, EventHex all do AI matchmaking, but every one of them is a *during-event* tool. AI matchmaking is now baseline, not a differentiator. The **post-event "afterparty" framing is the open lane** nobody owns. |
| **Feasibility** | Medium — no single hard part, but scope discipline is the real risk. With only an attendee list there is **no interaction data**, so the product must be honest: recommendations + clusters + editable graph, never fabricated "who you talked to." |
| **Free to build** | Mostly — Vercel, Supabase, and react-force-graph are free. Only unavoidable cost is the Anthropic API (cents per page at demo scale; pre-generate demo pages so the live pitch makes zero API calls). |
| **Monetization** | Story for the pitch, not built: Free (≤50 attendees) → Pro $299/event → Enterprise (white-label, CRM). A static pricing page is the only thing built in 9 days. |

### The honesty rule (read before building anything)
With **only an attendee list**, the app must NEVER claim to know who met whom. It knows who was *present* and can *recommend* who to connect with. Framing is always **post-event second chance**, never during-event planning:
> "You shared a room with hundreds of people you'll never meet again. Here are the 5 you should reach out to — before the afterparty ends."

Edges in the graph mean **"recommended"** or **"I marked them,"** never "they talked." This is what keeps the demo defensible on stage.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + Tailwind + shadcn/ui** | Solo-friendly, beautiful fast, Vercel-native. shadcn for polished components without design time. |
| Backend | **Next.js API routes / Server Actions** | No separate service. Claude calls and ingestion run server-side. |
| Database | **Supabase (Postgres)** | Free tier, relational fits events→attendees→connections, built-in storage for uploads, RLS for per-attendee page access. |
| AI / LLM | **Anthropic Claude API** (`claude-opus-4-8` for batch generation, `claude-haiku-4-5` for cheap clustering) | Core of matchmaking, clustering, and follow-up copy. Use Batch + prompt caching for cost. |
| Graph viz | **react-force-graph** (vasturiano) | Canvas/WebGL, handles zoom/drag/hover/click out of the box. Far faster to ship than raw D3 and won't render spaghetti. |
| Auth | **Supabase Auth** (magic-link) — *organizer only* | Attendees need NO login (page is a tokenized link — preserves the "no app" wedge). Only organizers log in. |
| Hosting | **Vercel** (free tier) + domain `afterparty.digital` | SSR for per-attendee pages, instant deploys. |
| Payments | **None built** — static pricing page only | Monetization is a pitch slide, not 9-day scope. |

---

## Environment Variables

```
# Required
ANTHROPIC_API_KEY=              # console.anthropic.com — for matchmaking/clustering/copy
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase project settings → API (public, RLS-guarded)
SUPABASE_SERVICE_ROLE_KEY=      # Supabase → API (server-only, ingestion + page generation)
NEXT_PUBLIC_APP_URL=            # https://afterparty.digital (for building share links)

# Optional
PAGE_TOKEN_SECRET=              # HMAC secret for signing per-attendee page tokens
```

---

## Data Model (build in Milestone 1, reference throughout)

- **events**: id, name, slug, organizer_id, event_date, dissolves_at, status
- **attendees**: id, event_id, name, title, company, bio, interests[], socials(jsonb), page_token (unique), created_at
- **connections**: id, event_id, source_attendee_id, target_attendee_id, kind (`recommended` | `marked` | `confirmed`), reason (text, AI-generated for `recommended`), created_at
- **clusters**: id, event_id, label, theme, attendee_ids[]
- **highlights**: id, event_id, title, body, source (optional — only if richer artifacts ever added)

RLS: an attendee page is readable only with a valid `page_token`. Organizer dashboard readable only by `organizer_id`.

---

## Milestones

> Maps to a 9-day solo sprint. **Demo viability is the priority** — a real DeveloperWeek attendee gets a stunning page that survives scrutiny beats four half-built features. Build the hero deep, fake the rest in the UI.

### Milestone 1: Scaffold + Data Layer *(Day 1)*
**Goal:** App runs locally, Supabase schema live, env wired.

Tasks:
- [x] Init Next.js 15 + Tailwind + shadcn/ui in repo root — Done when: `npm run dev` starts clean at localhost:3000 *(used Next.js **16** — `latest` has advanced; dev verified HTTP 200)*
- [x] Create Supabase project, apply schema above via migration — Done when: all 5 tables exist, RLS enabled on attendees/connections *(project `nxhitfftluvjwoyvzkos` live; migration applied — verified all 5 tables reachable and RLS returns 0 rows to anon)*
- [x] Add Supabase server + browser clients, commit `.env.example` — Done when: a server action can read/write `events` *(clients in `src/lib/supabase/`, `createEvent`/`getEventBySlug` in `src/lib/events.ts`, `.env.example` committed)*
- [x] Folder structure: `app/`, `lib/ai/`, `lib/supabase/`, `lib/ingest/`, `components/` — Done when: dirs exist with index stubs *(under `src/` per shadcn import alias)*

---

### Milestone 2: Ingestion — attendee list → structured attendees *(Day 2)*
**Goal:** Upload a CSV/JSON attendee list and get normalized attendee rows.

Tasks:
- [x] CSV/JSON upload endpoint + parser (PapaParse) that maps arbitrary columns → {name,title,company,bio,interests,socials} — Done when: uploading a messy real-world CSV produces clean attendee rows *(parser in `src/lib/ingest/parse.ts` with synonym-based header mapping, first/last-name merge, BOM strip, social-handle→URL, email dedupe; 6 unit tests pass; server action `ingestAttendeeList` + `/upload` UI; verified end-to-end against live DB)*
- [~] Claude normalization pass: infer `interests[]` from title/company/bio when missing — Done when: attendees with no explicit interests get sensible tags *(implemented in `src/lib/ingest/normalize.ts`, wired into ingest; **gracefully no-ops until `ANTHROPIC_API_KEY` is set** — output not yet verified with a live key)*
- [x] Generate unique `page_token` per attendee on ingest — Done when: every attendee row has a tokenized URL *(`src/lib/tokens.ts`, 96-bit base64url; verified all-unique on 8-row insert)*
- [x] UI shows other upload types (Discord, photos, recordings) as **disabled "coming soon"** — Done when: visible in UI but only the list path is wired *(4 disabled source tiles on `/upload`; no faked parsing)*

---

### Milestone 3: AI Core — clustering + matchmaking *(Days 3–4) ⭐ THE PRODUCT*
**Goal:** For an event's attendees, generate interest clusters and per-attendee "5 people you should meet + why."

> **Design change (2026-06-01):** built **key-free and deterministic** instead of Claude-first (user is skipping the Anthropic key for now). Clustering + matchmaking run as pure functions — free, fast, reproducible (great for a zero-API-call live demo), and fully honest. Claude becomes an **optional enhancement** for richer reason prose once a key is added.

Tasks:
- [x] Clustering: ~~Claude~~ **deterministic** grouping into ≤8 labeled interest clusters — Done when: clusters cover ~all attendees with human-readable themes, persisted to `clusters` *(`src/lib/ai/cluster.ts`; verified on sample → "AI" + "General Networking", every attendee covered once)*
- [x] Matchmaking: for each attendee, top 5 recommended connections with a specific one-line `reason` each — Done when: rows written to `connections` as `kind='recommended'`, reasons reference real attributes *(`src/lib/ai/match.ts`; scores by shared interest tags / cluster / company; reasons cite shared tags + title/company)*
- [~] ~~Claude **Batch** + caching~~ — **N/A for the keyless path** (cost is $0). Deferred: optional Claude pass to enrich reasons + catch semantic interest matches (e.g. "Devtools" ≈ "Developer Experience") once `ANTHROPIC_API_KEY` is set.
- [x] Guardrail: never assert two people met; only recommend — Done when: spot-check shows zero false "you talked to" claims *(enforced by construction; unit test asserts no reason matches met/talked/spoke/connected)*
- [x] Idempotent re-run (clear + regenerate per event) — Done when: re-running doesn't duplicate connections *(`generateForEvent` deletes prior clusters + `recommended` connections — preserving user `marked`/`confirmed` edges — before regenerating; verified reset → 0)*

---

### Milestone 4: The Afterparty Page *(Days 5–6) ⭐ THE HERO*
**Goal:** A gorgeous, tokenized, public personal page — the thing judges see themselves on.

> **Aesthetic:** vibrant & celebratory (user pick) — fuchsia/indigo/amber gradient washes, glowing graph nodes, glassmorphic cards on a near-black base so the neon reads.

Tasks:
- [x] Route `app/p/[token]/page.tsx` server-renders one attendee's afterparty — Done when: valid token shows that person; invalid/expired shows graceful state *(loader `src/lib/page-data.ts` returns `live`/`dissolved`/`not_found`; all three states render; verified HTTP 200 on real token + on bad token)*
- [x] Hero section: "Here was your room" — event name, attendee count, clusters — Done when: renders real data, looks designed *(gradient hero, name greeting, attendee count, cluster chips; verified "here was your room" + clusters in output)*
- [x] **5 people you should meet** cards with name/title/company + `reason` + "reach out" link — Done when: cards render real recommendations *(in `AfterpartyBoard`; reach-out picks LinkedIn>X>email>site; verified real reasons render)*
- [x] **Editable connection graph** (react-force-graph): nodes = you + recommendations + marked; add/remove/confirm edges; persists — Done when: edits survive reload *(`RelationshipGraph` + token-auth `setConnection` action; tap to confirm, search-to-add marked; verified confirmed+marked persist across reload)*
- [x] **30-day countdown** to `dissolves_at`, framed as privacy-by-design — Done when: live ticking timer, copy frames ephemerality as a feature *(`Countdown` component, "your data isn't kept a day longer than the memory")*
- [x] Mobile-responsive + share/open-graph image — Done when: looks great on a phone and link previews show the attendee's name *(responsive grids/stack; dynamic `opengraph-image.tsx` via next/og → "{name}'s afterparty", verified 200 image/png)*

---

### Milestone 5: Organizer Dashboard — ONE screen *(Day 7)*
**Goal:** The B2B ROI story in a single, screenshot-able view. Resist building a suite.

Tasks:
- [x] ~~Organizer magic-link auth~~ → **unguessable-link access** gating `/dashboard/[id]` — Done when: only someone with the link can view *(user-approved change: dashboard keyed by the event **UUID** — 122-bit, unguessable, never exposed to attendees. Zero login friction / email setup; real per-account SSO is the enterprise-roadmap line. Bad id → graceful "not found".)*
- [x] Cluster overview: full-event force graph colored by cluster + sizes — Done when: renders the whole room, visually legible *(`RoomGraph` + `cluster-colors` palette; nodes colored by cluster, legend with sizes; verified render)*
- [x] ROI stats: connection density, # clusters, top theme — Done when: numbers compute from real data *(`dashboard-data.ts`: density = % of all possible pairs mapped, connections mapped, **follow-ups started** (confirmed edges = real engagement), clusters count, top theme; all from live data)*
- [x] Upload + "generate" flow → attendee links works in the UI — Done when: end-to-end from upload to attendee links works *(`/upload` ingests→generates→shows sample attendee pages **and** an "Open organizer dashboard" link)*

---

### Milestone 6: DeveloperWeek Demo Data *(Day 8) ⭐ THE PITCH*
**Goal:** A real, pre-generated DeveloperWeek afterparty so the live demo makes zero API calls and never fails on stage.

Tasks:
- [x] Assemble a real DeveloperWeek 2026 attendee list into CSV — Done when: a real-names CSV exists *(scraped **448 of 455** real participants from the Devpost participants tab via the logged-in session, since Devpost has no participant export; name + specialty + curated interest tags. Lives in gitignored `demo-data/devpost-ny-2026.csv` — **real non-consented data, never committed, local-demo-only**.)*
- [x] Pre-run ingestion + generation, store as a seeded demo event — Done when: a fixed demo URL loads instantly with no live Claude call *(event slug `dwny-2026`, 448 attendees, 7 balanced interest clusters + General, 2240 connections; deterministic = zero API calls. Stable event id + page tokens across re-seeds.)*
- [~] Hand-curate "judge" attendee pages — *deferred: the dataset is participants, not judges. The "see yourself" moment uses the organizer's own page (Ishani's) + any real attendee. Curation optional.*
- [x] Seed script committed so the demo is reproducible — Done when: `npm run seed:demo` rebuilds the demo event *(`scripts/seed-demo.mjs`, idempotent, token/id-preserving)*

> **⚠️ Deploy gate (for M7):** the live DB now contains the real scraped participant event. Do **not** deploy a public site against it. Before M7, either point prod at a separate Supabase with a **synthetic** dataset, or remove the `dwny-2026` event from the deployed DB. Keep the scraped data local-only.

---

### Milestone 7: Deploy *(Day 9 AM)*
**Goal:** Live at the real domain.

Tasks:
- [ ] Deploy to Vercel, set all env vars — Done when: production URL serves the demo page
- [ ] Point `afterparty.digital` DNS to Vercel — Done when: https://afterparty.digital loads the landing page
- [ ] Static landing + pricing page (Free / Pro $299 / Enterprise) — Done when: pitch-ready marketing page is live

---

### Milestone 8: Polish + Pitch *(Day 9 PM)*
**Goal:** No rough edges on the demo path; pitch rehearsed.

Tasks:
- [ ] Loading/empty/expired states on every page — Done when: no raw errors anywhere on the happy path
- [ ] Consent/privacy microcopy: organizer-gated, opt-out, 30-day dissolve as data-minimization — Done when: a judge asking "did people consent?" has a visible on-page answer
- [ ] Rehearse the demo script: "This hackathon ends tonight — here's what afterparty.digital already built for it" → live judge page — Done when: run end-to-end 3× under 3 minutes
- [ ] Record a 60s fallback video in case live demo network fails — Done when: video exists and is linked in README

---

## Stretch (only if ahead — do NOT start before Milestone 6 is done)
- Reconnect inbox: "people you haven't reached out to yet" nudge list.
- Richer ingestion: a real Discord export parser to upgrade edges from `recommended` → actual co-presence (this is the future-vision slide made real).
- Sponsor/session ROI breakdown on the dashboard.

---

## Claude Code Commands

**Start fresh (Milestone 1):**
```
claude "Read PLAN.md and complete Milestone 1. Mark tasks done as you go. Stop after Milestone 1 and commit."
```

**Resume from any point:**
```
claude "Read PLAN.md, find the first incomplete task, and continue. Mark tasks done as you go. Commit when a milestone is complete."
```

**Test the current state:**
```
claude "Read PLAN.md. Without building anything new, test everything that's marked done. Report what works and what's broken."
```

---

## Notes & Decisions

- **2026-06-01** — Confirmed demo data is **attendee-list-only** (no Discord/interaction data). Pivoted core feature from "relationship detection" to **honest matchmaking + editable intent graph**, framed strictly as post-event "afterparty" second-chance. The during/before-event platform idea is deferred to a roadmap slide, not built — it reintroduces cold-start and surrenders the post-event positioning.
- **Wedge** — AI matchmaking is commoditized (Brella/Grip/Swapcard); the *afterparty / post-event* frame is the only defensible differentiator.
- **Hero priority order**: Afterparty page (M4) > AI core (M3) > Demo data (M6) > Organizer dashboard (M5). If time runs out, the dashboard shrinks to a single static-looking screen.
- **Cost control** — demo pages pre-generated; live pitch makes zero Claude calls.
- **2026-06-01 (Milestone 5 done)** — Organizer dashboard at `/dashboard/[id]` (the event UUID = unguessable link; no auth/email setup — user-approved over magic-link). ROI screen: stat cards (connection density %, connections mapped, follow-ups started, room size), full-room `RoomGraph` colored by cluster with sized legend, top theme. Loader `src/lib/dashboard-data.ts`; shared palette `src/lib/cluster-colors.ts` (extracted so the server page + client graph share it — RSC boundary fix). `/upload` now surfaces the dashboard link. Verified 200 + all sections on the seeded event; bad id → graceful not-found.
- **2026-06-01 (Milestone 4 done) ⭐ HERO** — Tokenized afterparty page at `/p/[token]` (vibrant/celebratory): gradient hero, cluster chips, live 30-day `Countdown`, interactive `AfterpartyBoard` (glowing react-force-graph + "5 people to meet" cards + search-to-add). Editing via token-auth `setConnection` action (`src/lib/connections.ts`); confirm/mark persist across reload (verified). Dynamic OG image. Graceful `not_found`/`dissolved` states. Loader: `src/lib/page-data.ts`. **A seeded demo event "DeveloperWeek 2026 (demo)" (slug `smoke-demo`, 8 attendees) is live in the DB** — Ada's page (`/p/7aWZSezXnbYSZh2-`) shows a confirmed + marked example. Re-seed logic should move into a committed script in Milestone 6.
- **2026-06-01 (Milestone 3 done, key-free)** — AI core built as **deterministic** clustering (`src/lib/ai/cluster.ts`) + matchmaking (`src/lib/ai/match.ts`), orchestrated by `generateForEvent` (`src/lib/generate.ts`), auto-run after ingest from `/upload`. No Anthropic key required → live demo makes **zero API calls**. 11 unit tests pass (incl. honesty-rule + determinism). Verified end-to-end on live DB. **Claude is now an optional enhancement** (richer reasons + semantic interest matching) gated on `ANTHROPIC_API_KEY`; the deterministic path is the default and always works.
- **2026-06-01 (Milestone 2 done)** — Ingestion pipeline complete: robust CSV/JSON parser (`src/lib/ingest/`), unique page tokens (`src/lib/tokens.ts`), `ingestAttendeeList` server action (`src/lib/attendees.ts`), `/upload` UI with disabled "coming soon" source tiles. `npm run test` runs node:test parser suite (6 passing) via Node 24 type-stripping; added `allowImportingTsExtensions` to tsconfig for the explicit `.ts` test imports. Sample data at `samples/attendees-sample.csv`. **Only the Claude interest-inference step is unverified — needs `ANTHROPIC_API_KEY`** (no-ops gracefully until then).
- **2026-06-01 (Milestone 1 done)** — Scaffolded with **Next.js 16.2.7** (the `latest` tag moved past 15), React 19, Tailwind v4, shadcn/ui (`base-nova` style). src-dir layout, so plan's `lib/*` live under `src/lib/*`. Stack additions installed: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`, `react-force-graph-2d`. **One manual step remains before Milestone 2:** create a Supabase project and apply `supabase/migrations/0001_init.sql`, then fill `.env.local`.
