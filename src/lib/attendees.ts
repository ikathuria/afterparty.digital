"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { parseAttendeeFile } from "@/lib/ingest/parse";
import { inferMissingInterests } from "@/lib/ingest/normalize";
import { generatePageToken } from "@/lib/tokens";
import type { AttendeeRow } from "@/lib/supabase/types";

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "event"}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface IngestResult {
  ok: boolean;
  error?: string;
  eventId?: string;
  eventSlug?: string;
  count?: number;
  withInterests?: number;
  sample?: { name: string; title: string | null; page_token: string }[];
}

/**
 * Full ingestion: parse an uploaded attendee list, infer missing interests,
 * create an event, and insert one attendee row per person with a unique
 * page_token. Uses the service-role client (RLS-bypassing) since ingestion is
 * an organizer/server action.
 */
export async function ingestAttendeeList(formData: FormData): Promise<IngestResult> {
  const eventName = String(formData.get("eventName") ?? "").trim();
  const file = formData.get("file");

  if (!eventName) return { ok: false, error: "Event name is required." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Please choose a CSV or JSON file." };

  let parsed;
  try {
    const text = await file.text();
    parsed = parseAttendeeFile(file.name, text);
  } catch (e) {
    return { ok: false, error: `Could not parse file: ${(e as Error).message}` };
  }
  if (parsed.length === 0)
    return { ok: false, error: "No attendees with a usable name were found in that file." };

  // Optional AI enrichment — no-ops without ANTHROPIC_API_KEY.
  const enriched = await inferMissingInterests(parsed);

  const supabase = createAdminClient();
  const slug = slugify(eventName);

  const { data: event, error: evErr } = await supabase
    .from("events")
    .insert({ name: eventName, slug, status: "draft" })
    .select()
    .single();
  if (evErr || !event) return { ok: false, error: `Event create failed: ${evErr?.message}` };

  const rows = enriched.map((a) => ({
    event_id: event.id,
    name: a.name,
    title: a.title,
    company: a.company,
    bio: a.bio,
    interests: a.interests,
    socials: a.socials,
    page_token: generatePageToken(),
  }));

  const { data: inserted, error: atErr } = await supabase
    .from("attendees")
    .insert(rows)
    .select("name, title, page_token, interests");
  if (atErr || !inserted)
    return { ok: false, error: `Attendee insert failed: ${atErr?.message}` };

  const attendees = inserted as Pick<AttendeeRow, "name" | "title" | "page_token" | "interests">[];

  return {
    ok: true,
    eventId: event.id,
    eventSlug: event.slug,
    count: attendees.length,
    withInterests: attendees.filter((a) => a.interests.length > 0).length,
    sample: attendees.slice(0, 5).map((a) => ({
      name: a.name,
      title: a.title,
      page_token: a.page_token,
    })),
  };
}
