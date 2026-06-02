import { createAdminClient } from "@/lib/supabase/server";

export interface RoomNode {
  id: string;
  name: string;
  cluster: number; // index into clusters; -1 if none
}
export interface RoomLink {
  source: string;
  target: string;
}

export interface DashboardStats {
  attendees: number;
  clusters: number;
  /** % of all possible attendee pairs that were mapped as a suggested connection */
  density: number;
  mappedConnections: number; // unique undirected recommended pairs
  followUps: number; // confirmed connections (real engagement signal)
  topTheme: string | null;
}

export interface DashboardData {
  found: boolean;
  event?: { name: string; dissolvesAt: string | null };
  stats?: DashboardStats;
  clusters?: { label: string; size: number }[];
  graph?: { nodes: RoomNode[]; links: RoomLink[] };
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Load the organizer ROI view for an event. Keyed by the event UUID, which is
 * unguessable (122-bit v4) and never exposed to attendees — the "secret link"
 * access model. No login required.
 */
export async function getDashboard(eventId: string): Promise<DashboardData> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("name, dissolves_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { found: false };

  const [{ data: attendees = [] }, { data: clusterRows = [] }, { data: conns = [] }] =
    await Promise.all([
      supabase.from("attendees").select("id, name").eq("event_id", eventId),
      supabase.from("clusters").select("label, attendee_ids").eq("event_id", eventId),
      supabase.from("connections").select("source_attendee_id, target_attendee_id, kind").eq("event_id", eventId),
    ]);

  const att = attendees ?? [];
  const clusters = clusterRows ?? [];
  const connections = conns ?? [];

  // attendee -> cluster index
  const clusterOf = new Map<string, number>();
  clusters.forEach((c, i) => (c.attendee_ids as string[]).forEach((id) => clusterOf.set(id, i)));

  // unique undirected recommended pairs (the "mapped connections")
  const recPairs = new Set<string>();
  for (const c of connections) {
    if (c.kind === "recommended") recPairs.add(pairKey(c.source_attendee_id, c.target_attendee_id));
  }
  const followUps = connections.filter((c) => c.kind === "confirmed").length;

  const n = att.length;
  const possible = (n * (n - 1)) / 2;
  const density = possible > 0 ? Math.round((recPairs.size / possible) * 100) : 0;

  // top theme = largest cluster that isn't the catch-all, else largest
  const sized = clusters
    .map((c) => ({ label: c.label as string, size: (c.attendee_ids as string[]).length }))
    .sort((a, b) => b.size - a.size);
  const topTheme =
    sized.find((c) => c.label !== "General Networking")?.label ?? sized[0]?.label ?? null;

  // graph: nodes colored by cluster, links from unique recommended pairs
  const nodes: RoomNode[] = att.map((a) => ({
    id: a.id,
    name: a.name,
    cluster: clusterOf.get(a.id) ?? -1,
  }));
  const links: RoomLink[] = [...recPairs].map((k) => {
    const [source, target] = k.split("|");
    return { source, target };
  });

  return {
    found: true,
    event: { name: event.name, dissolvesAt: event.dissolves_at },
    stats: {
      attendees: n,
      clusters: clusters.length,
      density,
      mappedConnections: recPairs.size,
      followUps,
      topTheme,
    },
    clusters: sized,
    graph: { nodes, links },
  };
}
