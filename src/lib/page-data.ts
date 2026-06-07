import { db } from "@/lib/db";
import type { AttendeeRow, EventRow } from "@/lib/types";

export interface PersonLite {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  socials: Record<string, string>;
  note?: string | null;
}

export interface Recommendation extends PersonLite {
  reason: string | null;
  confirmed: boolean;
}

export type PageState = "live" | "dissolved" | "not_found";

export interface AfterpartyData {
  state: PageState;
  you?: PersonLite & { bio: string | null; interests: string[] };
  event?: { name: string; dissolvesAt: string | null; attendeeCount: number };
  clusters?: string[]; // labels this attendee belongs to
  recommendations?: Recommendation[];
  marked?: PersonLite[];
  others?: PersonLite[]; // remaining attendees, for "add someone we missed"
}

type RosterRow = Pick<AttendeeRow, "id" | "name" | "title" | "company" | "socials">;
type ConnRow = { target_attendee_id: string; kind: string; reason: string | null; note: string | null };

function toLite(a: RosterRow): PersonLite {
  return { id: a.id, name: a.name, title: a.title, company: a.company, socials: a.socials };
}

/**
 * Load everything an afterparty page needs, keyed by the unguessable page_token
 * (the bearer credential). Returns a `state` the page renders on.
 */
export async function getAfterpartyByToken(token: string): Promise<AfterpartyData> {
  const sql = db();

  const meRows = (await sql`
    select id, event_id, name, title, company, bio, interests, socials
    from attendees where page_token = ${token} limit 1
  `) as (Pick<AttendeeRow, "id" | "event_id" | "name" | "title" | "company" | "bio" | "interests" | "socials">)[];
  const me = meRows[0];
  if (!me) return { state: "not_found" };

  const eventRows = (await sql`
    select name, status, dissolves_at, event_date from events where id = ${me.event_id} limit 1
  `) as Pick<EventRow, "name" | "status" | "dissolves_at" | "event_date">[];
  const event = eventRows[0];
  if (!event) return { state: "not_found" };

  const dissolved =
    event.status === "dissolved" ||
    (event.dissolves_at != null && new Date(event.dissolves_at).getTime() < Date.now());
  if (dissolved) {
    return { state: "dissolved", event: { name: event.name, dissolvesAt: event.dissolves_at, attendeeCount: 0 } };
  }

  const roster = (await sql`
    select id, name, title, company, socials from attendees where event_id = ${me.event_id}
  `) as RosterRow[];
  const rosterById = new Map(roster.map((r) => [r.id, r]));

  const conns = (await sql`
    select target_attendee_id, kind, reason, note
    from connections where source_attendee_id = ${me.id}
  `) as ConnRow[];

  const confirmed = new Set(conns.filter((c) => c.kind === "confirmed").map((c) => c.target_attendee_id));
  const markedIds = conns.filter((c) => c.kind === "marked").map((c) => c.target_attendee_id);

  // best note per target (confirmed > marked > recommended)
  const KIND_RANK: Record<string, number> = { confirmed: 3, marked: 2, recommended: 1 };
  const noteByTarget = new Map<string, string>();
  for (const c of [...conns].sort((a, b) => (KIND_RANK[a.kind] ?? 0) - (KIND_RANK[b.kind] ?? 0))) {
    if (c.note) noteByTarget.set(c.target_attendee_id, c.note);
  }

  const recommendations: Recommendation[] = conns
    .filter((c) => c.kind === "recommended" && rosterById.has(c.target_attendee_id))
    .map((c) => {
      const t = rosterById.get(c.target_attendee_id)!;
      return { ...toLite(t), reason: c.reason, confirmed: confirmed.has(t.id), note: noteByTarget.get(t.id) ?? null };
    });

  const marked: PersonLite[] = markedIds
    .filter((id) => rosterById.has(id))
    .map((id) => ({ ...toLite(rosterById.get(id)!), note: noteByTarget.get(id) ?? null }));

  const clusterRows = (await sql`
    select label, attendee_ids from clusters where event_id = ${me.event_id}
  `) as { label: string; attendee_ids: string[] }[];
  const clusters = clusterRows.filter((c) => c.attendee_ids.includes(me.id)).map((c) => c.label);

  const shown = new Set<string>([me.id, ...recommendations.map((r) => r.id), ...markedIds]);
  const others = roster.filter((r) => !shown.has(r.id)).map(toLite);

  return {
    state: "live",
    you: {
      id: me.id,
      name: me.name,
      title: me.title,
      company: me.company,
      bio: me.bio,
      interests: me.interests,
      socials: me.socials,
    },
    event: { name: event.name, dissolvesAt: event.dissolves_at, attendeeCount: roster.length },
    clusters,
    recommendations,
    marked,
    others,
  };
}
