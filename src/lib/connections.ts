"use server";

import { db } from "@/lib/db";

/**
 * Token-authenticated edits to an attendee's connection graph. The page_token
 * is the bearer credential: we resolve it to the source attendee server-side,
 * so a caller can only ever edit their own edges.
 */
async function resolveSource(token: string): Promise<{ id: string; event_id: string } | null> {
  const sql = db();
  const rows = (await sql`
    select id, event_id from attendees where page_token = ${token} limit 1
  `) as { id: string; event_id: string }[];
  return rows[0] ?? null;
}

/** Validate that target is a real attendee of the same event. */
async function isSameEventAttendee(eventId: string, targetId: string): Promise<boolean> {
  const sql = db();
  const rows = (await sql`
    select 1 from attendees where id = ${targetId} and event_id = ${eventId} limit 1
  `) as unknown[];
  return rows.length > 0;
}

const KIND_RANK: Record<string, number> = { confirmed: 3, marked: 2, recommended: 1 };

/**
 * Save (or clear) the attendee's private note about a person. Stored on their
 * best existing connection row (confirmed > marked > recommended); if none
 * exists, a `marked` row is created to hold it.
 */
export async function saveNote(
  token: string,
  targetId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await resolveSource(token);
  if (!me) return { ok: false, error: "Invalid page." };
  if (!(await isSameEventAttendee(me.event_id, targetId))) return { ok: false, error: "Unknown attendee." };

  const sql = db();
  const trimmed = note.trim() || null;

  const rows = (await sql`
    select id, kind from connections
    where source_attendee_id = ${me.id} and target_attendee_id = ${targetId}
  `) as { id: string; kind: string }[];
  const best = rows.sort((a, b) => (KIND_RANK[b.kind] ?? 0) - (KIND_RANK[a.kind] ?? 0))[0];

  try {
    if (best) {
      await sql`update connections set note = ${trimmed} where id = ${best.id}`;
    } else {
      await sql`
        insert into connections (event_id, source_attendee_id, target_attendee_id, kind, note)
        values (${me.event_id}, ${me.id}, ${targetId}, 'marked', ${trimmed})
      `;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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
  if (!(await isSameEventAttendee(me.event_id, targetId))) return { ok: false, error: "Unknown attendee." };

  const sql = db();
  try {
    if (on) {
      await sql`
        insert into connections (event_id, source_attendee_id, target_attendee_id, kind)
        values (${me.event_id}, ${me.id}, ${targetId}, ${kind})
        on conflict (source_attendee_id, target_attendee_id, kind) do nothing
      `;
    } else {
      await sql`
        delete from connections
        where source_attendee_id = ${me.id} and target_attendee_id = ${targetId} and kind = ${kind}
      `;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
