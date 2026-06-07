"use server";

import { db } from "@/lib/db";
import type { EventRow } from "@/lib/types";

/**
 * Create an event. Used by ingestion / seed flows.
 */
export async function createEvent(input: {
  name: string;
  slug: string;
  eventDate?: string;
}): Promise<EventRow> {
  const sql = db();
  const rows = (await sql`
    insert into events (name, slug, event_date)
    values (${input.name}, ${input.slug}, ${input.eventDate ?? null})
    returning *
  `) as EventRow[];
  return rows[0];
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const sql = db();
  const rows = (await sql`select * from events where slug = ${slug} limit 1`) as EventRow[];
  return rows[0] ?? null;
}
