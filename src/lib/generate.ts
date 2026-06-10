"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { computeClusters, type AttendeeLite } from "@/lib/ai/cluster";
import { computeMatches } from "@/lib/ai/match";
import type { AttendeeRow } from "@/lib/supabase/types";

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
  const supabase = createAdminClient();

  const { data: rows, error: aErr } = await supabase
    .from("attendees")
    .select("id, name, title, company, interests")
    .eq("event_id", eventId);
  if (aErr) return { ok: false, error: `load attendees failed: ${aErr.message}` };
  if (!rows || rows.length === 0) return { ok: false, error: "No attendees for this event." };

  const attendees = rows as AttendeeLite[];

  // --- compute ---
  const clusters = computeClusters(attendees);
  const clusterOf = new Map<string, string>();
  clusters.forEach((c, idx) => c.attendeeIds.forEach((id) => clusterOf.set(id, String(idx))));
  const matches = computeMatches(attendees, clusterOf);

  // --- idempotent reset (only AI-derived rows) ---
  await supabase.from("clusters").delete().eq("event_id", eventId);
  await supabase.from("connections").delete().eq("event_id", eventId).eq("kind", "recommended");

  // --- persist clusters ---
  const { error: cErr } = await supabase.from("clusters").insert(
    clusters.map((c) => ({
      event_id: eventId,
      label: c.label,
      theme: c.theme,
      attendee_ids: c.attendeeIds,
    })),
  );
  if (cErr) return { ok: false, error: `insert clusters failed: ${cErr.message}` };

  // --- persist connections ---
  const connRows: {
    event_id: string;
    source_attendee_id: string;
    target_attendee_id: string;
    kind: "recommended";
    reason: string;
  }[] = [];
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
  if (connRows.length > 0) {
    const { error: connErr } = await supabase.from("connections").insert(connRows);
    if (connErr) return { ok: false, error: `insert connections failed: ${connErr.message}` };
  }

  // --- set live + dissolve timer ---
  const dissolvesAt = new Date(Date.now() + DISSOLVE_DAYS * 86400_000).toISOString();
  const { error: eErr } = await supabase
    .from("events")
    .update({ status: "live", dissolves_at: dissolvesAt })
    .eq("id", eventId);
  if (eErr) return { ok: false, error: `event update failed: ${eErr.message}` };

  return {
    ok: true,
    clusters: clusters.length,
    connections: connRows.length,
    dissolvesAt,
  };
}

// Re-export for server-side callers that already hold attendee rows.
export type { AttendeeRow };
