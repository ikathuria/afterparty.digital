# afterparty.digital — Hackathon Submission

> **Every event ends. The connections shouldn't.**

afterparty.digital is an AI-powered space that activates the moment an event
ends. From nothing more than an attendee list, it generates a personal,
beautiful, time-limited page for every attendee — who was in their room, the
specific people they should follow up with and *why*, and an editable map of
their connections that gracefully dissolves in 30 days. Organizers get the first
real dashboard of human connection at their event.

---

## ⚡ Elevator pitch

80% of the connections made at events are lost within 72 hours. Event organizers
spend millions proving ROI with attendance numbers — a metric that says nothing
about whether the event actually *worked*. **afterparty.digital fixes both
problems at once.** Upload your event's attendee list and we generate a personal
AI memory-and-matchmaking page for every attendee, plus a connection-ROI
dashboard for the organizer. The page dissolves in 30 days. The relationships
don't have to.

---

## 🎯 The problem

- Conferences and hackathons are *terrible* places to actually connect — you're
  rushed, overstimulated, you meet 40 people and remember 4, and the best
  conversation gets cut off when the next session starts.
- The real connecting was always going to happen **after**. But after the event,
  the context evaporates: you can't remember names, you never followed up, and
  the LinkedIn requests go nowhere.
- Meanwhile **organizers** can only measure attendance. They have no way to show
  that their event produced *meaningful connections* — the thing sponsors and
  executives actually pay for.

Every networking product on the market (Brella, Swapcard, Grip, Whova) attacks
this *during* the event, where nobody has attention to spare, and they all suffer
the same cold-start failure. **The post-event window is wide open, and it's where
the value actually is.** That's the wedge afterparty.digital owns.

---

## ✨ What it does

### For attendees — a personal "afterparty" page
Each attendee gets a private, unguessable link to a page that includes:

- **"Here was your room"** — the event, how many people were there, and the
  interest clusters they belong to.
- **People you should meet** — the top matches for *this* person, each with a
  specific, grounded reason ("You're both into AI — and they're a Principal
  Researcher at Bletchley Labs").
- **Copy intro** — a ready-to-send, personalized outreach message for each
  person, so following up is one tap, not a blank-page chore.
- **An editable relationship graph** — a glowing force-directed map. Tap a node
  for a detail panel, hover to trace someone's connections, confirm follow-ups,
  and search-and-add anyone the AI missed.
- **Private notes** per person ("met at the AI panel — intro me to their
  cofounder").
- **Take it with you** — export your connections as a vCard before the page
  dissolves, and share your page.
- **A 30-day countdown** — the page is ephemeral *on purpose*, framed as
  privacy-by-design: your data isn't kept a day longer than the memory.

### For organizers — a connection-ROI dashboard
A single, screenshot-ready screen that finally answers "did the event work?":

- **ROI stats**: attendees, connections mapped, average intros per attendee, and
  number of interest clusters.
- **The room, mapped** — the entire event as a force-directed graph with
  communities visually separated and color-coded by interest.
- **Interactive exploration** — click a cluster to highlight it; search the full
  attendee roster.

This is the metric event organizers have never been able to produce: not
attendance, but a map of *who's worth connecting to whom*.

---

## 💡 The key insight: the "honesty rule"

With only an attendee list, there is **no interaction data** — so the product can
never honestly claim to know who actually met whom. Most teams would fake it.
We made honesty the core design principle and a competitive advantage:

- The product knows who was *present* and **recommends** who's worth meeting.
- Every connection edge is typed `recommended`, `marked` (the user added them),
  or `confirmed` (the user is following up) — **never** "they talked."
- The UI says so out loud: *"We never claim who you actually met — only who's
  worth meeting."*

This is enforced in the data model, the matchmaking prompts/logic, and the unit
tests (a test asserts that no generated reason ever claims people met). It's what
makes the product trustworthy enough to put in front of the very people it's
describing.

---

## 🔬 How it works (the pipeline)

1. **Ingest** — Upload a CSV/JSON attendee list. A robust parser maps messy
   real-world headers (`Full Name` or first+last, `Job Title`/`Specialty`,
   social handles → full URLs, free-text interest lists), de-dupes, and
   normalizes everyone into clean attendee records. (Other sources — Discord,
   recordings, photos — are shown as honest "coming soon," never faked.)
2. **Cluster** — A size-balanced algorithm groups the room into recognizable
   interest communities (e.g., DevOps, ML/AI, Fintech, Web), avoiding the
   "everyone's in one giant blob" failure mode by load-balancing across each
   person's interests.
3. **Match** — For every attendee, a deterministic engine scores everyone else
   by shared interests, shared cluster, and shared company, and produces the top
   recommendations with a human, grounded reason for each.
4. **Generate** — Clusters and recommendations are persisted; the event goes
   live with a 30-day dissolve timer. Re-running is idempotent and preserves
   user edits (`marked`/`confirmed`) and shareable links.
5. **Deliver** — Every attendee gets a tokenized link; the organizer gets the
   dashboard.

The matchmaking core is **deterministic and key-free**. That's a deliberate
engineering choice with real benefits: it's **free**, **reproducible** (great for
a live demo that must never fail or surprise), and **privacy-preserving** — no
attendee data is sent to any third-party model. Anthropic's Claude is wired in as
an *optional* enhancement (inferring interest tags from titles/bios when a key is
present), never a hard dependency.

---

## 🛠️ Tech stack & architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, `src/`), React 19, TypeScript | Server Components + Server Actions keep the data layer on the server; fast to build, Vercel-native. |
| Styling | **Tailwind v4**, shadcn/ui, sonner | Polished, responsive, "vibrant & celebratory" theme without bespoke design time. |
| Database | **Supabase** (Postgres) via `@supabase/supabase-js` | Managed Postgres with a clean query layer and Row-Level Security; relational schema (events → attendees → connections → clusters) fits the domain. |
| Graph viz | **react-force-graph-2d** | Canvas/WebGL force-directed graphs that stay legible at hundreds of nodes. |
| AI | Deterministic engine + optional **Anthropic Claude** | Zero-cost, reproducible core; AI as enhancement, not crutch. |
| Hosting | **Vercel**, gated by a custom `src/proxy.ts` | Whole site behind HTTP Basic Auth + `noindex` when `SITE_PASSWORD` is set. |

**Notable engineering details**
- Next.js 16 renamed the `middleware` convention to `proxy` — the password gate
  is implemented correctly against the new API (Node runtime).
- The relational schema models `text[]` interest tags and `jsonb` socials
  directly, with Row-Level Security enabled and access mediated by unguessable
  page tokens in server actions.
- Unit tests (Node's built-in test runner) cover the parser, clustering, and the
  honesty rule, run with Node 24's native TypeScript execution — no test
  framework dependency.
- Idempotent seed + generation: re-seeding preserves attendee page tokens and
  the dashboard URL, so shared demo links never break.

---

## 🔒 Privacy & ethics by design

This is a product *about people*, so privacy is a first-class feature, not an
afterthought:

- **Unguessable URLs** — attendee pages use 96-bit tokens; dashboards use the
  event UUID. There is no public, browsable directory of attendees.
- **Token-scoped writes** — every edit (confirm, mark, note) validates the page
  token server-side, so you can only ever edit your own graph.
- **Ephemeral** — pages carry a real `dissolves_at` and go dark afterward; data
  isn't retained beyond the memory's usefulness.
- **No third-party data sharing** — the core engine runs locally/deterministically.
- **Deployment gate** — `SITE_PASSWORD` puts the entire site behind a password
  with search-engine `noindex`, so any non-public demo data stays private.

---

## 💰 Business model

The events industry is a **$1.3T** market; every conference, meetup, and
corporate summit is a customer. The organizer pays; attendees get value free.

- **Free** — up to 50 attendees: personal pages, matchmaking, 30-day dissolve.
- **Pro — $299/event** — unlimited attendees, the organizer ROI dashboard,
  connection-density & cluster analytics, sponsor/session reports.
- **Enterprise** — white-labeled pages, CRM integration, SSO, year-round
  community tools.

---

## ✅ What's built (it's real and end-to-end)

This is a working product, not a mockup. Every milestone is implemented and
verified:

- Full ingestion pipeline with a tested, resilient parser.
- Deterministic clustering + matchmaking with an honest-by-construction reason
  generator.
- The complete attendee page: graph, recommendations, copy-intro, notes, vCard
  export, share, countdown, and graceful not-found/dissolved states.
- The organizer dashboard with live stats, an interactive room graph, and a
  searchable roster.
- A live demo seeded from a real event's attendee data, generating clusters and
  matches with **zero API calls** at demo time.
- Password-gated deployment path, dynamic Open Graph images, mobile-responsive
  throughout.

---

## 🧗 Challenges we worked through

- **Honest matchmaking from list-only data.** No interaction data exists, so we
  designed the entire system to recommend rather than assert — and enforced it in
  the schema and tests.
- **Cluster balance.** Real interest data is lopsided (a majority tagged "AI"),
  which collapsed everyone into one blob. We built a size-balanced assignment
  that produces even, recognizable communities.
- **Graph legibility at scale.** Hundreds of nodes with thousands of edges is a
  hairball; we render only intra-cluster edges, colored by community, so the
  force layout separates the groups visually.
- **A fast-moving framework.** Next.js 16 shipped breaking changes (e.g.,
  `middleware` → `proxy`); we read the installed docs and implemented against the
  current APIs rather than assumptions.

---

## 🚀 What's next

- **Richer signals** — an optional Discord-export parser upgrades edges from
  "recommended" to actual co-presence, turning matchmaking into true memory.
- **Reconnect nudges** — gentle reminders for follow-ups not yet started.
- **Sponsor/session ROI** — attribute connection density to specific sessions
  and sponsors.
- **Real per-account auth & CRM export** for the enterprise tier.

---

## 🏆 Why it stands out

- **Immediately understandable** — the value lands in under 10 seconds, and the
  domain name *is* the product.
- **A genuine wedge** — owns the open post-event window instead of fighting in
  the crowded during-event category.
- **Two-sided value** — an emotional hook for attendees and a hard ROI story for
  the organizers who hold the budget.
- **Trustworthy by design** — the honesty rule and privacy-by-design make it
  safe to show people pages about themselves.
- **Complete and demonstrable** — a real, working build with a live demo on
  actual event data, not slideware.
