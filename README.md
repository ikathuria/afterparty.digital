# afterparty.digital

> **Every event ends. The connections shouldn't.**

An AI-powered **post-event** platform. Upload an event's attendee list and every
attendee gets a personal, time-limited "afterparty" page: who was in their room,
the people they should reach out to and *why*, and an editable connection graph
that dissolves in 30 days. Organizers get a one-screen connection-ROI dashboard.

Built solo for the DeveloperWeek 2026 hackathon. Full build plan in [`PLAN.md`](./PLAN.md).

## The honesty rule

With only an attendee list there is **no interaction data**, so the product never
claims to know who met whom. It knows who was *present* and *recommends* who to
connect with. Graph edges mean `recommended` / `marked` / `confirmed` — never
"they talked." This is what keeps the live demo defensible.

## Stack

Next.js 16 (App Router) · Tailwind v4 · shadcn/ui · Supabase (Postgres) ·
Anthropic Claude API · react-force-graph · Vercel.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in Supabase + Anthropic keys
npm run dev                  # http://localhost:3000
```

Apply the database schema once — see [`supabase/README.md`](./supabase/README.md).
