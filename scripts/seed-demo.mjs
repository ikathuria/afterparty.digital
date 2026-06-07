// Seed a demo event from a local attendee CSV into Neon.
//   node --env-file=.env.local scripts/seed-demo.mjs [csvPath] [eventName] [slug]
// Defaults to the gitignored DeveloperWeek NY 2026 participant export.
//
// The CSV is intentionally NOT committed (real, non-consented participant data
// lives only in demo-data/). This script is generic and safe to commit.

import { readFileSync } from "node:fs";
import { db, insertRows } from "../src/lib/db.ts";
import { parseAttendeeFile } from "../src/lib/ingest/parse.ts";
import { generatePageToken } from "../src/lib/tokens.ts";
import { computeClusters } from "../src/lib/ai/cluster.ts";
import { computeMatches } from "../src/lib/ai/match.ts";

const csvPath = process.argv[2] || "demo-data/devpost-ny-2026.csv";
const eventName = process.argv[3] || "DeveloperWeek NY 2026";
const slug = process.argv[4] || "dwny-2026";

const sql = db();
const parsed = parseAttendeeFile(csvPath, readFileSync(csvPath, "utf8"));
console.log(`parsed ${parsed.length} attendees from ${csvPath}`);

// Preserve existing page tokens (by name) + the event id across re-seeds.
const prior = (await sql`select id from events where slug = ${slug} limit 1`)[0];
const tokenByName = new Map();
if (prior) {
  for (const a of await sql`select name, page_token from attendees where event_id = ${prior.id}`)
    tokenByName.set(a.name, a.page_token);
}

const dissolvesAt = new Date(Date.now() + 30 * 86400_000).toISOString();
let event;
if (prior) {
  await sql`delete from connections where event_id = ${prior.id}`;
  await sql`delete from clusters where event_id = ${prior.id}`;
  await sql`delete from attendees where event_id = ${prior.id}`;
  event = (
    await sql`update events set name = ${eventName}, status = 'live', dissolves_at = ${dissolvesAt}
              where id = ${prior.id} returning *`
  )[0];
} else {
  event = (
    await sql`insert into events (name, slug, status, dissolves_at)
              values (${eventName}, ${slug}, 'live', ${dissolvesAt}) returning *`
  )[0];
}

const rows = parsed.map((a) => ({
  event_id: event.id,
  name: a.name,
  title: a.title,
  company: a.company,
  bio: a.bio,
  interests: a.interests,
  socials: a.socials,
  page_token: tokenByName.get(a.name) ?? generatePageToken(),
}));
await insertRows(
  "attendees",
  ["event_id", "name", "title", "company", "bio", "interests", "socials", "page_token"],
  rows,
  { interests: "text[]", socials: "jsonb" },
);

const inserted = await sql`select id, name, title, interests, page_token from attendees where event_id = ${event.id}`;

const clusters = computeClusters(inserted);
const clusterOf = new Map();
clusters.forEach((c, i) => c.attendeeIds.forEach((id) => clusterOf.set(id, String(i))));
const matches = computeMatches(inserted, clusterOf);

await insertRows(
  "clusters",
  ["event_id", "label", "theme", "attendee_ids"],
  clusters.map((c) => ({ event_id: event.id, label: c.label, theme: c.theme, attendee_ids: c.attendeeIds })),
  { attendee_ids: "uuid[]" },
);

const conn = [];
for (const [src, recs] of matches)
  for (const r of recs)
    conn.push({ event_id: event.id, source_attendee_id: src, target_attendee_id: r.targetId, kind: "recommended", reason: r.reason });
await insertRows("connections", ["event_id", "source_attendee_id", "target_attendee_id", "kind", "reason"], conn);

console.log(`\n✓ seeded "${eventName}" (${inserted.length} attendees, ${clusters.length} clusters, ${conn.length} connections)`);
console.log(`  event id (dashboard): ${event.id}`);
console.log(`\nclusters:`);
for (const c of clusters) console.log(`  • ${c.label} (${c.attendeeIds.length})`);
console.log(`\nsample attendee pages:`);
for (const a of inserted.slice(0, 6)) console.log(`  ${a.name.padEnd(26)} /p/${a.page_token}`);
