-- afterparty.digital — add private per-connection notes.
-- A note is the attendee's own memory about a person ("met at the AI panel",
-- "intro me to their cofounder"). Distinct from `reason` (which holds the
-- AI-generated recommendation text on `recommended` rows).
--
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)

alter table public.connections add column if not exists note text;
