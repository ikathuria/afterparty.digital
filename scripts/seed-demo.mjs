// Seed a demo event from a local attendee CSV.
//   node --env-file=.env.local scripts/seed-demo.mjs [csvPath] [eventName] [slug]
// Defaults to the gitignored DeveloperWeek NY 2026 participant export.
//
// The CSV is intentionally NOT committed (real, non-consented participant
// data lives only in demo-data/). This script is generic and safe to commit.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseAttendeeFile } from "../src/lib/ingest/parse.ts";
import { generatePageToken } from "../src/lib/tokens.ts";
import { computeClusters } from "../src/lib/ai/cluster.ts";
import { computeMatches } from "../src/lib/ai/match.ts";

const csvPath = process.argv[2] || "demo-data/devpost-ny-2026.csv";
const eventName = process.argv[3] || "DeveloperWeek NY 2026";
const slug = process.argv[4] || "dwny-2026";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const parsed = parseAttendeeFile(csvPath, readFileSync(csvPath, "utf8"));
console.log(`parsed ${parsed.length} attendees from ${csvPath}`);

// reset any prior seed of this slug
await admin.from("events").delete().eq("slug", slug);
const dissolvesAt = new Date(Date.now() + 30 * 86400_000).toISOString();
const { data: ev, error: evErr } = await admin
  .from("events")
  .insert({ name: eventName, slug, status: "live", dissolves_at: dissolvesAt })
  .select()
  .single();
if (evErr) throw new Error(evErr.message);

// insert attendees with tokens (chunked)
const rows = parsed.map((a) => ({ event_id: ev.id, ...a, page_token: generatePageToken() }));
const inserted = [];
for (let i = 0; i < rows.length; i += 200) {
  const { data, error } = await admin
    .from("attendees")
    .insert(rows.slice(i, i + 200))
    .select("id, name, title, interests, page_token");
  if (error) throw new Error(error.message);
  inserted.push(...data);
}

// generate clusters + matches
const clusters = computeClusters(inserted);
const clusterOf = new Map();
clusters.forEach((c, i) => c.attendeeIds.forEach((id) => clusterOf.set(id, String(i))));
const matches = computeMatches(inserted, clusterOf);

await admin.from("clusters").insert(
  clusters.map((c) => ({ event_id: ev.id, label: c.label, theme: c.theme, attendee_ids: c.attendeeIds })),
);

const conn = [];
for (const [src, recs] of matches)
  for (const r of recs)
    conn.push({ event_id: ev.id, source_attendee_id: src, target_attendee_id: r.targetId, kind: "recommended", reason: r.reason });
for (let i = 0; i < conn.length; i += 500) {
  const { error } = await admin.from("connections").insert(conn.slice(i, i + 500));
  if (error) throw new Error(error.message);
}

console.log(`\n✓ seeded "${eventName}" (${inserted.length} attendees, ${clusters.length} clusters, ${conn.length} connections)`);
console.log(`  event id (dashboard): ${ev.id}`);
console.log(`\nclusters:`);
for (const c of clusters) console.log(`  • ${c.label} (${c.attendeeIds.length})`);
console.log(`\nsample attendee pages:`);
for (const a of inserted.slice(0, 6)) console.log(`  ${a.name.padEnd(26)} /p/${a.page_token}`);
