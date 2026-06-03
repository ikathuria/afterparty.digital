# Deploying afterparty.digital

> ⚠️ **This deployment carries real, non-consented scraped participant data.**
> It is **password-gated** (`src/proxy.ts`) so it is never publicly accessible
> or search-indexable. Keep it that way: always set `SITE_PASSWORD` in the
> deployed environment. Never remove the gate while the real `dwny-2026` event
> is in the database.

## 1. Push to GitHub
Already done — repo: `github.com/ikathuria/afterparty.digital`.

## 2. Import into Vercel
1. vercel.com → **Add New… → Project** → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). No build settings to change.

## 3. Environment variables (Project → Settings → Environment Variables)
Set these for **Production** (and Preview if you want):

```
NEXT_PUBLIC_SUPABASE_URL=        # same Supabase project
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # publishable key
SUPABASE_SERVICE_ROLE_KEY=       # secret key (server only)
NEXT_PUBLIC_APP_URL=https://afterparty.digital
SITE_PASSWORD=<choose a strong password>   # REQUIRED — gates the whole site
```
`ANTHROPIC_API_KEY` is optional (the app is deterministic and key-free).

## 4. Deploy
Click **Deploy**. When it's live, visiting any page prompts for a password
(any username, the `SITE_PASSWORD` you set). Share that password only with
people you want to see the demo (e.g. judges).

## 5. Custom domain (optional)
Project → Settings → Domains → add `afterparty.digital`, then point your
registrar's DNS to Vercel (A/ALIAS or the provided CNAME).

## Security model recap
- **Password gate** (`SITE_PASSWORD`) — whole site behind HTTP Basic Auth.
- **noindex** — `robots: { index: false }` in the root layout blocks crawlers.
- **Unguessable URLs** — attendee pages use 96-bit tokens; dashboards use the
  event UUID. No browsable directory of people exists.
- **Token-scoped writes** — edit actions validate the page_token server-side.

## If you ever want a truly public deploy
Re-seed the database with a **synthetic** dataset (e.g. generate fake
attendees), delete the real `dwny-2026` event, then you may remove
`SITE_PASSWORD`. Do not expose the scraped DeveloperWeek data publicly.
