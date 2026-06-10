# Supabase

Schema lives in `migrations/0001_init.sql`.

## Apply it (one-time, needs your Supabase project)

**Option A — SQL editor (fastest):** open your project → SQL Editor → paste the
contents of `migrations/0001_init.sql` → Run.

**Option B — CLI:**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

After applying, fill `.env.local` from `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  from Project Settings → API.

## Verify
- 5 tables exist: `events`, `attendees`, `connections`, `clusters`, `highlights`.
- RLS is enabled on all five (no anon read/write; organizer-scoped policies only).
- Public attendee pages are served via the service-role client after validating
  `page_token`, so they work despite RLS being locked to anon.
