"use server";

import { db, insertRows } from "@/lib/db";
import { parseAttendeeFile } from "@/lib/ingest/parse";
import { inferMissingInterests } from "@/lib/ingest/normalize";
import { generateForEvent } from "@/lib/generate";
import { generatePageToken } from "@/lib/tokens";
import type { AttendeeRow, EventRow } from "@/lib/types";

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
  clusters?: number;
  connections?: number;
  sample?: { name: string; title: string | null; page_token: string }[];
}

/**
 * Full ingestion: parse an uploaded attendee list, infer missing interests,
 * create an event, and insert one attendee row per person with a unique
 * page_token, then run deterministic generation.
 */
export async function ingestAttendeeList(formData: FormData): Promise<IngestResult> {
  const eventName = String(formData.get("eventName") ?? "").trim();
  const file = formData.get("file");

  if (!eventName) return { ok: false, error: "Event name is required." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Please choose a CSV or JSON file." };

  let parsed;
  try {
    parsed = parseAttendeeFile(file.name, await file.text());
  } catch (e) {
    return { ok: false, error: `Could not parse file: ${(e as Error).message}` };
  }
  if (parsed.length === 0)
    return { ok: false, error: "No attendees with a usable name were found in that file." };

  // Optional AI enrichment — no-ops without ANTHROPIC_API_KEY.
  const enriched = await inferMissingInterests(parsed);

  const sql = db();
  const slug = slugify(eventName);

  try {
    const eventRows = (await sql`
      insert into events (name, slug, status) values (${eventName}, ${slug}, 'draft')
      returning *
    `) as EventRow[];
    const event = eventRows[0];

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
    await insertRows(
      "attendees",
      ["event_id", "name", "title", "company", "bio", "interests", "socials", "page_token"],
      rows,
      { interests: "text[]", socials: "jsonb" },
    );

    const inserted = (await sql`
      select name, title, page_token, interests from attendees where event_id = ${event.id}
    `) as Pick<AttendeeRow, "name" | "title" | "page_token" | "interests">[];

    const gen = await generateForEvent(event.id);

    return {
      ok: true,
      eventId: event.id,
      eventSlug: event.slug,
      count: inserted.length,
      withInterests: inserted.filter((a) => a.interests.length > 0).length,
      clusters: gen.ok ? gen.clusters : undefined,
      connections: gen.ok ? gen.connections : undefined,
      sample: inserted.slice(0, 5).map((a) => ({ name: a.name, title: a.title, page_token: a.page_token })),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
