import { createAdminClient } from "@/lib/supabase/server";
import type { AttendeeRow, EventRow } from "@/lib/supabase/types";

export interface PersonLite {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  socials: Record<string, string>;
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

function toLite(a: Pick<AttendeeRow, "id" | "name" | "title" | "company" | "socials">): PersonLite {
  return { id: a.id, name: a.name, title: a.title, company: a.company, socials: a.socials };
}

/**
 * Load everything an afterparty page needs, keyed by the unguessable
 * page_token. Uses the service-role client (RLS-bypassing) after the token
 * acts as the bearer credential. Returns a `state` the page renders on.
 */
export async function getAfterpartyByToken(token: string): Promise<AfterpartyData> {
  const supabase = createAdminClient();

  const { data: me } = await supabase
    .from("attendees")
    .select("id, event_id, name, title, company, bio, interests, socials")
    .eq("page_token", token)
    .maybeSingle();
  if (!me) return { state: "not_found" };

  const { data: event } = await supabase
    .from("events")
    .select("name, status, dissolves_at, event_date")
    .eq("id", me.event_id)
    .single<Pick<EventRow, "name" | "status" | "dissolves_at" | "event_date">>();
  if (!event) return { state: "not_found" };

  const dissolved =
    event.status === "dissolved" ||
    (event.dissolves_at != null && new Date(event.dissolves_at).getTime() < Date.now());
  if (dissolved) {
    return { state: "dissolved", event: { name: event.name, dissolvesAt: event.dissolves_at, attendeeCount: 0 } };
  }

  // roster (everyone in the event)
  const { data: roster = [] } = await supabase
    .from("attendees")
    .select("id, name, title, company, socials")
    .eq("event_id", me.event_id);
  const rosterById = new Map((roster ?? []).map((r) => [r.id, r]));

  // this attendee's connections
  const { data: conns = [] } = await supabase
    .from("connections")
    .select("target_attendee_id, kind, reason")
    .eq("source_attendee_id", me.id);

  const confirmed = new Set(
    (conns ?? []).filter((c) => c.kind === "confirmed").map((c) => c.target_attendee_id),
  );
  const markedIds = (conns ?? []).filter((c) => c.kind === "marked").map((c) => c.target_attendee_id);

  const recommendations: Recommendation[] = (conns ?? [])
    .filter((c) => c.kind === "recommended" && rosterById.has(c.target_attendee_id))
    .map((c) => {
      const t = rosterById.get(c.target_attendee_id)!;
      return { ...toLite(t), reason: c.reason, confirmed: confirmed.has(t.id) };
    });

  const marked: PersonLite[] = markedIds
    .filter((id) => rosterById.has(id))
    .map((id) => toLite(rosterById.get(id)!));

  // clusters this attendee belongs to
  const { data: clusterRows = [] } = await supabase
    .from("clusters")
    .select("label, attendee_ids")
    .eq("event_id", me.event_id);
  const clusters = (clusterRows ?? [])
    .filter((c) => (c.attendee_ids as string[]).includes(me.id))
    .map((c) => c.label as string);

  // "others" = roster minus me, minus recommended, minus marked
  const shown = new Set<string>([me.id, ...recommendations.map((r) => r.id), ...markedIds]);
  const others = (roster ?? []).filter((r) => !shown.has(r.id)).map(toLite);

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
    event: { name: event.name, dissolvesAt: event.dissolves_at, attendeeCount: roster?.length ?? 0 },
    clusters,
    recommendations,
    marked,
    others,
  };
}
