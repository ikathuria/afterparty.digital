"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/supabase/types";

/**
 * Server action proving the data layer round-trips (Milestone 1 done-when:
 * "a server action can read/write events"). Uses the service-role client so
 * ingestion/seed flows can create events without an authenticated organizer.
 */
export async function createEvent(input: {
  name: string;
  slug: string;
  eventDate?: string;
}): Promise<EventRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ name: input.name, slug: input.slug, event_date: input.eventDate ?? null })
    .select()
    .single();

  if (error) throw new Error(`createEvent failed: ${error.message}`);
  return data as EventRow;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select()
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getEventBySlug failed: ${error.message}`);
  return (data as EventRow) ?? null;
}
