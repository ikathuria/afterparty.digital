# afterparty.digital — Project Tracker

> Living context map. Any LLM or human should be able to read this file alone and understand
> what the project is, how it's built, and where things are. **Keep it in sync** — update it
> whenever the stack, structure, conventions, or status changes.

_Last updated: 2026-06-11_

---

## What it is

A **post-event** networking platform: organizers upload an attendee list, and every attendee gets a personal, time-limited "afterparty" page — who shared the room with them, 5 AI-recommended people to reach out to (with reasons), and an editable connection graph that dissolves in 30 days. Organizers get a one-screen ROI dashboard. Built solo for the DeveloperWeek 2026 hackathon (Phase 1, shipped and deployed); now evolving into a real product (Phase 2: LinkedIn sign-in, multi-event user dashboard, mutual "we met" confirmation — see `PLAN.md`).

**The honesty rule (core product constraint):** the app never claims to know who met whom unless both parties attested it. Edge kinds: `recommended` (AI suggestion), `marked` (one-sided "I want to connect / I met them"), `confirmed` (mutual attestation or in-person QR scan). Nothing is ever inferred from attendance alone.

---

## Stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | **16.2.7** | ⚠️ Breaking changes vs training data — read `node_modules/next/dist/docs/` first. `middleware` is now **`src/proxy.ts`**. |
| UI | Tailwind v4 + shadcn/ui (@base-ui), lucide, sonner | tailwind ^4, shadcn ^4.10 | |
| React | React | 19.2.4 | |
| Database | Supabase Postgres (project `nxhitfftluvjwoyvzkos`) | supabase-js ^2.106.2 | Free tier **auto-pauses after ~7 idle days** → `fetch failed`; restore via dashboard. A Neon migration exists in git history (`5d43227`, reverted in `61aef8a`) if ever needed. |
| Auth | Supabase Auth — `linkedin_oidc` + magic link (Phase 2) | @supabase/ssr ^0.10.3 | Phase 1 had no auth (token links + UUID dashboards). LinkedIn gives identity only — its connections graph API is partner-only; **do not** plan around it. |
| Graph viz | react-force-graph-2d | ^1.29.1 | |
| AI core | Deterministic, key-free (`src/lib/ai/`) | — | `ANTHROPIC_API_KEY` is an optional enhancement (richer prose, semantic matching) — enhance, never replace, the deterministic path. |
| Hosting | Vercel (user's account) | — | Site is HTTP-Basic-gated via `SITE_PASSWORD` while real data is in prod. |

> Versions from `package.json`, verified 2026-06-11. **Before coding against any library, fetch its latest official docs** — never code framework APIs from memory.

---

## Architecture

1. **Ingestion:** organizer uploads CSV at `/upload` → `src/lib/ingest/` parses → rows in `events` / `attendees`.
2. **Generation:** `src/lib/generate.ts` orchestrates the deterministic AI core — `src/lib/ai/cluster.ts` (size-balanced theme clusters) + `src/lib/ai/match.ts` (top-5 recommendations with reasons) → `clusters` / `connections` rows.
3. **Attendee page:** `/p/[token]` (unguessable token, no login) renders the afterparty: recommendations, force graph, countdown, notes, vCard export.
4. **Organizer dashboard:** `/dashboard/[id]` (unguessable UUID) — stats, cluster-colored room graph, searchable attendee table.
5. **All DB access is server-side** via the service-role key; the anon key + RLS path arrives with Phase 2 auth.
6. **Gate:** `src/proxy.ts` applies HTTP Basic Auth when `SITE_PASSWORD` is set; `robots: noindex`.

---

## Project structure

```
repo-root/
├─ src/
│  ├─ app/                 # routes: / (landing+pricing), /upload, /p/[token], /dashboard/[id]
│  ├─ components/
│  │  ├─ afterparty/       # attendee-page components (graph, cards, countdown, notes…)
│  │  ├─ dashboard/        # organizer dashboard components
│  │  └─ ui/               # shadcn primitives
│  ├─ lib/
│  │  ├─ ai/               # cluster.ts, match.ts — deterministic core (+ *.test.ts)
│  │  ├─ ingest/           # CSV parsing
│  │  ├─ supabase/         # DB clients
│  │  └─ generate.ts       # orchestrator
│  └─ proxy.ts             # Next 16 middleware (Basic Auth gate)
├─ supabase/migrations/    # SQL migrations — user pastes into Supabase SQL editor (no DDL via service key)
├─ scripts/seed-demo.mjs   # idempotent demo seeder (preserves tokens/event ids) — do NOT delete scripts/
├─ demo-data/              # gitignored — real scraped DeveloperWeek data, NEVER commit
├─ docs/                   # 01-hackathon-plan.md (Phase 1 archive)
├─ PLAN.md                 # Phase 2 build plan
└─ PROJECT.md              # this file
```

---

## Conventions

- **New code:** components by surface (`components/afterparty|dashboard`), logic in `src/lib/<area>/`, tests colocated as `*.test.ts`.
- **Testing:** `npm run test` (node:test, Node 24 type-stripping). Gotcha: relative value-imports in test-reachable modules need an explicit `.ts` extension.
- **Migrations:** numbered `NNNN_name.sql` in `supabase/migrations/`; applied manually by the user.
- **Build gotcha (Windows/OneDrive):** if `npm run build` throws EPERM on `.next/server/middleware`, stop the dev server and delete `.next`.
- **Docs:** `docs/` filenames zero-padded kebab-case.
- **Before coding any library:** fetch its latest official docs (Next 16 docs ship in `node_modules/next/dist/docs/`).

---

## Current status

| Milestone (Phase 2 — PLAN.md) | Status | Notes |
|---|---|---|
| 1. Auth foundation (LinkedIn OIDC) | ☐ todo | Needs user one-time setup: LinkedIn dev app + Supabase provider config |
| 2. Claim your afterparty page | ☐ todo | |
| 3. My events dashboard (`/me`) | ☐ todo | |
| 4. Mutual "we met" confirmation | ☐ todo | |
| 5. QR auto-confirm | ☐ todo | |
| 6. Production hardening + relaunch | ☐ todo | ⚠️ must purge real `dwny-2026` data before public signup |

Phase 1 (hackathon): **all 8 milestones complete and deployed** to Vercel (password-gated). Archive: `docs/01-hackathon-plan.md`.

**In progress now:** nothing — Phase 2 not started.
**Next up:** Milestone 1, task 1.

---

## Glossary

- **Afterparty page** — an attendee's personal post-event page at `/p/[token]`, expiring 30 days after the event.
- **Honesty rule** — never claim two people met without mutual attestation (see top of file).
- **Claim** — linking an attendee row to a signed-in user (token possession or email match), Phase 2.
- **meet_code / QR auto-confirm** — per-attendee code; both parties scanning in person creates a `confirmed` edge automatically (physical presence = mutual attestation).
- **dwny-2026** — event seeded from real scraped DeveloperWeek NY participants (non-consented; local/password-gated demo ONLY). `smoke-demo` — small 8-attendee synthetic event.
- **Dissolve** — the 30-day countdown after which a page expires (urgency mechanic).
