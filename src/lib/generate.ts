"use server";

import { db, insertRows } from "@/lib/db";
import { computeClusters, type AttendeeLite } from "@/lib/ai/cluster";
import { computeMatches } from "@/lib/ai/match";
import type { AttendeeRow } from "@/lib/types";

const DISSOLVE_DAYS = 30;

export interface GenerateResult {
  ok: boolean;
  error?: string;
  clusters?: number;
  connections?: number;
  dissolvesAt?: string;
}

/**
 * Generate the afterparty for an event: interest clusters + per-attendee
 * recommendations. Deterministic and key-free. Idempotent — clears prior
 * clusters and AI-recommended connections (never user `marked`/`confirmed`
 * edges) before regenerating, then sets the event live with a 30-day timer.
 */
export async function generateForEvent(eventId: string): Promise<GenerateResult> {
  const sql = db();

  const attendees = (await sql`
    select id, name, title, company, interests from attendees where event_id = ${eventId}
  `) as AttendeeLite[];
  if (attendees.length === 0) return { ok: false, error: "No attendees for this event." };

  // --- compute ---
  const clusters = computeClusters(attendees);
  const clusterOf = new Map<string, string>();
  clusters.forEach((c, idx) => c.attendeeIds.forEach((id) => clusterOf.set(id, String(idx))));
  const matches = computeMatches(attendees, clusterOf);

  try {
    // --- idempotent reset (only AI-derived rows) ---
    await sql`delete from clusters where event_id = ${eventId}`;
    await sql`delete from connections where event_id = ${eventId} and kind = 'recommended'`;

    // --- persist clusters ---
    await insertRows(
      "clusters",
      ["event_id", "label", "theme", "attendee_ids"],
      clusters.map((c) => ({ event_id: eventId, label: c.label, theme: c.theme, attendee_ids: c.attendeeIds })),
      { attendee_ids: "uuid[]" },
    );

    // --- persist connections ---
    const connRows: Record<string, unknown>[] = [];
    for (const [sourceId, recs] of matches) {
      for (const r of recs) {
        connRows.push({
          event_id: eventId,
          source_attendee_id: sourceId,
          target_attendee_id: r.targetId,
          kind: "recommended",
          reason: r.reason,
        });
      }
    }
    await insertRows(
      "connections",
      ["event_id", "source_attendee_id", "target_attendee_id", "kind", "reason"],
      connRows,
    );

    // --- set live + dissolve timer ---
    const dissolvesAt = new Date(Date.now() + DISSOLVE_DAYS * 86400_000).toISOString();
    await sql`update events set status = 'live', dissolves_at = ${dissolvesAt} where id = ${eventId}`;

    return { ok: true, clusters: clusters.length, connections: connRows.length, dissolvesAt };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type { AttendeeRow };
