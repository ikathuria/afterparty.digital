# afterparty.digital — Phase 2: Accounts, Multi-Event, Real Connections

> Post-hackathon evolution of afterparty.digital ("Every event ends. The connections shouldn't."): LinkedIn sign-in for everyone, a cross-event personal dashboard, and mutual "we met" confirmation that is as automatic as legitimately possible. The hackathon build (Phase 1, complete) is archived at `docs/01-hackathon-plan.md`.

---

## Viability Summary

| | |
|---|---|
| **Market** | Crowded during-event (Swapcard, Brella, Blinq badges all do QR contact exchange), but the **post-event afterparty lane is still open**. Phase 2 keeps that wedge and adds the retention loop competitors lack: your connections accumulate across events under one login. |
| **Feasibility** | Medium — LinkedIn OIDC via Supabase is a documented, free path. The hard part is **identity plumbing** (claiming attendee rows, RLS) on a codebase that deliberately had zero auth. |
| **Free to build** | Yes — Supabase free tier includes the LinkedIn (OIDC) provider; LinkedIn developer app is free; no new paid services. |
| **Monetization** | Unchanged pitch (Free / Pro $299/event / Enterprise). Confirmed-meeting counts become the organizer ROI metric that justifies Pro. |

### Constraints carried over from Phase 1 (still binding)

1. **The honesty rule.** The product never claims to know who met whom unless **both parties attested it** (mutual confirm or in-person QR scan). Edge kinds: `recommended` (AI), `marked` (one-sided), `confirmed` (mutual). Never infer meetings.
2. **LinkedIn's connection graph is NOT accessible.** The Connections API is partner-program-only (formal review, mostly rejected) and connection timestamps aren't exposed at all; scraping violates ToS. **Rejected approach — do not revisit.** Sign-in gives identity only: name, email, photo, and (via `/v2/userinfo`) the member id. "Automatic" confirmation therefore comes from **QR scan exchange** (physical presence), the same mechanism Swapcard/Blinq use.
3. **The production DB contains real scraped DeveloperWeek participant data** (event `dwny-2026`, non-consented, gitignored CSV). The site is HTTP-Basic-gated via `src/proxy.ts` + `SITE_PASSWORD`. **Public signup must not launch against that dataset** — see Milestone 6.
4. **Next.js 16 has breaking changes** (e.g. `middleware` → `proxy`). Per `AGENTS.md`: read `node_modules/next/dist/docs/` before writing framework code. Same rule for Supabase Auth — fetch current docs first, never code from memory.
5. Deterministic AI core stays key-free; `ANTHROPIC_API_KEY` remains an optional enhancement.

---

## Tech Stack (delta only — full stack in PROJECT.md)

> Versions verified against the repo's `package.json` and official docs on 2026-06-11. Re-check before coding.

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Auth | **Supabase Auth, `linkedin_oidc` provider** | supabase-js ^2.106, @supabase/ssr ^0.10 (already installed) | Built-in provider; OIDC sign-in is the one LinkedIn product open to all developers. Keep magic-link as fallback for users without LinkedIn. |
| Sessions in Next | **@supabase/ssr** cookie-based clients | ^0.10.3 | Official pattern for Next.js App Router server components + route handlers. |
| QR generation | **`qrcode`** (or render via `next/og`) | latest at install time | Tiny, free, server- or client-side. |
| Email nudges (optional) | **Resend** free tier | — | Only if confirm-nudge emails are wanted; defer until Milestone 6. |

New external setup (user-performed, one-time):
- LinkedIn Developers → create app → add **"Sign In with LinkedIn using OpenID Connect"** product → copy client id/secret.
- Supabase Dashboard → Auth → Providers → **LinkedIn (OIDC)** → paste credentials. Callback URL: `https://<project-ref>.supabase.co/auth/v1/callback` (also add it in the LinkedIn app).

---

## Data model changes

```sql
-- 0003: identity
profiles (id uuid PK references auth.users, full_name, avatar_url, linkedin_url, created_at)
attendees + user_id uuid NULL references profiles(id)   -- set when claimed
attendees + claim_email text NULL                        -- optional: organizer-provided email for auto-match

-- 0004: meeting confirmation
connections.kind already supports 'recommended' | 'marked' | 'confirmed'
connections + met_claimed_by uuid NULL    -- who first said "we met"
connections + confirmed_at timestamptz NULL
attendees + meet_code text UNIQUE         -- short random code embedded in the personal QR
```

RLS posture: all reads currently flow through server code using the service key; new policies must let an **authenticated user** read/update only their own `profiles` row and claimed `attendees` rows, and insert/upgrade `connections` only where they are source or target. Migrations are pasted into the Supabase SQL editor by the user (no DDL via service key).

---

## Milestones

### Milestone 1: Auth foundation
**Goal:** Anyone can sign in with LinkedIn; sessions work across server components and route handlers; signed-in state is visible in the header.

Tasks:
- [ ] Read `node_modules/next/dist/docs/` (routing, route handlers, proxy) and current Supabase Auth SSR docs before coding — Done when: noted in PROJECT.md which APIs differ from defaults
- [ ] User task: create LinkedIn developer app + enable LinkedIn (OIDC) provider in Supabase (instructions above) — Done when: provider shows "enabled" in dashboard
- [ ] Add `src/lib/supabase/` browser + server cookie clients per @supabase/ssr docs — Done when: `npm run test` and `npm run build` pass
- [ ] `/login` page with "Continue with LinkedIn" (`signInWithOAuth({ provider: 'linkedin_oidc' })`) + magic-link fallback, and `/auth/callback` route handler — Done when: full round-trip sign-in works locally
- [ ] Migration `0003_identity.sql` (profiles + trigger to create profile row on signup, attendees.user_id) with RLS policies — Done when: user pastes SQL; signing in creates a profiles row
- [ ] Header auth widget (avatar, sign out) on landing + afterparty pages — Done when: visible signed-in/out states

### Milestone 2: Claim your afterparty page
**Goal:** A token link (`/p/[token]`) can be claimed by a signed-in user, linking the attendee row to their account and enriching it from LinkedIn.

Tasks:
- [ ] "Claim this page with LinkedIn" CTA on `/p/[token]` when unclaimed; claiming sets `attendees.user_id` (token possession = proof) — Done when: claimed page shows owner avatar; second account cannot claim it
- [ ] On claim, pull name/photo into the profile and let the user add their LinkedIn URL — Done when: LinkedIn URL renders on their attendee card for others
- [ ] Auto-match on sign-in: if `claim_email` matches the auth email, offer one-click claim of those pages — Done when: seeded test attendee with matching email gets the prompt
- [ ] Token links keep working unauthenticated (the no-app wedge) — Done when: signed-out visit to `/p/[token]` is unchanged

### Milestone 3: My events dashboard
**Goal:** One place per user listing every afterparty they've claimed — the multi-event retention loop.

Tasks:
- [ ] `/me` route (auth-protected via session check, not proxy) listing claimed pages: event name, date, countdown, follow-up progress — Done when: a user with 2 claimed events sees both
- [ ] Cross-event "people" view: all confirmed + marked connections across events with copy/export (reuse vCard code) — Done when: connections from 2 events appear in one list
- [ ] Post-sign-in redirect lands on `/me`; empty state explains how pages get claimed — Done when: new user sees useful empty state

### Milestone 4: Mutual "we met" confirmation
**Goal:** Honest confirmed edges: one side claims, the other confirms; both see a solid edge.

Tasks:
- [ ] "We met at the event" button on attendee cards (requires claimed page) → sets/creates edge `marked` + `met_claimed_by` — Done when: claimer sees "waiting for them to confirm"
- [ ] Counterpart sees pending confirmations on their page + `/me`; one tap upgrades both directions to `confirmed` — Done when: both graphs show the solid edge
- [ ] Graph styling: `confirmed` solid/bright, `marked` dashed, `recommended` dotted; legend updated — Done when: visually distinct in `/p/[token]` graph
- [ ] Organizer dashboard: confirmed-meetings count + rate (the ROI metric) — Done when: stat reflects test confirmations

### Milestone 5: QR auto-confirm (the "automatic" path)
**Goal:** Two people who physically scan each other skip manual confirmation entirely — scan = mutual presence = instant `confirmed`.

Tasks:
- [ ] Generate per-attendee `meet_code` + QR on their afterparty page (shareable/printable card) — Done when: QR encodes `/meet/[code]`
- [ ] `/meet/[code]`: signed-in visitor with a claimed page in the same event → instant `confirmed` edge both ways + toast; signed-out visitor → sign-in/claim flow first, then auto-completes — Done when: phone-scan demo works end-to-end
- [ ] Abuse guards: same-event check, self-scan no-op, idempotent repeat scans, simple rate limit — Done when: each case has a test
- [ ] Honesty copy: confirmed edges labeled "you both confirmed you met" — Done when: tooltip/detail panel says it

### Milestone 6: Production hardening + relaunch
**Goal:** Safe public deploy with auth live.

Tasks:
- [ ] Resolve the real-data gate: delete `dwny-2026` from the prod DB and seed a synthetic demo event (or move real data behind a separate password-gated env) — Done when: public site contains no non-consented personal data
- [ ] Decide `SITE_PASSWORD` scope: drop the global gate once real data is out; keep `robots noindex` only on demo pages — Done when: `/` and `/login` are publicly reachable
- [ ] RLS audit: verify anon/authenticated roles can only do what Milestones 1–5 intend (attempt cross-user reads/writes in a test script) — Done when: audit script passes
- [ ] Optional: confirm-nudge email via Resend free tier — Done when: claiming "we met" emails the counterpart (skip if deferring)
- [ ] Update README/SUBMISSION → README reflects Phase 2; redeploy to Vercel (user runs deploy + sets env) — Done when: live site sign-in works

---

## Environment Variables (delta)

```
# Existing (unchanged): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL, SITE_PASSWORD (to be retired in M6)

# LinkedIn OIDC credentials live in the Supabase dashboard, NOT in this app's env.

# Optional (Milestone 6)
RESEND_API_KEY=        # resend.com — confirm-nudge emails
```

---

## Claude Code Commands

> In every session: fetch latest official docs before coding against any library (Next 16 docs are in `node_modules/next/dist/docs/`), and keep `PROJECT.md` in sync.

**Start Phase 2:**
```
claude "Read PLAN.md and PROJECT.md. Complete Milestone 1, fetching the latest official docs for any library before using it. Update PROJECT.md to reflect what you built. Mark tasks done as you go. Stop after Milestone 1 and commit."
```

**Resume:**
```
claude "Read PLAN.md and PROJECT.md. Find the first incomplete task and continue, fetching the latest official docs for any library before using it. Keep PROJECT.md in sync. Mark tasks done as you go. Commit when a milestone is complete."
```

**Test current state:**
```
claude "Read PLAN.md and PROJECT.md. Without building anything new, test everything that's marked done. Report what works and what's broken."
```

---

## Notes & Decisions

- **2026-06-11** — LinkedIn connection-graph import rejected (partner-only API, no timestamps, scraping = ToS violation). Automatic confirmation = QR scan exchange instead.
- **2026-06-11** — Token links remain the unauthenticated entry point; LinkedIn sign-in *upgrades* a page (claim), it doesn't gate it. Preserves the "no app, no login" first-touch wedge.
- **2026-06-11** — Kept flat `src/` layout (no `apps/web` restructure): working deployed app, restructure is churn with no second surface planned.
- **2026-06-11** — DB migrations are applied by the user pasting SQL into the Supabase SQL editor (no DDL via service key) — every migration task includes that handoff.
