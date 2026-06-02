"use server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Token-authenticated edits to an attendee's connection graph. The page_token
 * is the bearer credential: we resolve it to the source attendee server-side,
 * so a caller can only ever edit their own edges.
 */
async function resolveSource(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("attendees")
    .select("id, event_id")
    .eq("page_token", token)
    .maybeSingle();
  return data; // { id, event_id } | null
}

/** Validate that target is a real attendee of the same event. */
async function isSameEventAttendee(eventId: string, targetId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("attendees")
    .select("id")
    .eq("id", targetId)
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data;
}

export async function setConnection(
  token: string,
  targetId: string,
  kind: "marked" | "confirmed",
  on: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const me = await resolveSource(token);
  if (!me) return { ok: false, error: "Invalid page." };
  if (targetId === me.id) return { ok: false, error: "Cannot connect to yourself." };
  if (!(await isSameEventAttendee(me.event_id, targetId)))
    return { ok: false, error: "Unknown attendee." };

  const supabase = createAdminClient();

  if (on) {
    const { error } = await supabase.from("connections").upsert(
      {
        event_id: me.event_id,
        source_attendee_id: me.id,
        target_attendee_id: targetId,
        kind,
      },
      { onConflict: "source_attendee_id,target_attendee_id,kind", ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("connections")
      .delete()
      .eq("source_attendee_id", me.id)
      .eq("target_attendee_id", targetId)
      .eq("kind", kind);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
