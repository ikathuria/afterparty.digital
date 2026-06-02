// Deterministic interest clustering — groups attendees into labeled themes
// from their interest tags. No API key required; fully reproducible.
//
// Honesty rule: clusters describe shared *interests*, never shared
// conversations. An edge to a cluster means "interested in X", not "met here".

export interface AttendeeLite {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  interests: string[];
}

export interface ComputedCluster {
  label: string;
  theme: string | null;
  attendeeIds: string[];
}

export function normalizeTag(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const GENERAL_LABEL = "General Networking";

/**
 * Assign each attendee to one primary cluster, chosen as their highest-frequency
 * interest tag so people coalesce into the room's dominant themes. Singletons
 * and tag-less attendees fall into a "General Networking" bucket. Caps the
 * cluster count, merging the long tail into General.
 */
export function computeClusters(
  attendees: AttendeeLite[],
  opts: { maxClusters?: number } = {},
): ComputedCluster[] {
  const maxClusters = opts.maxClusters ?? 8;

  // tag frequency (by attendee) + a display label per normalized tag
  const freq = new Map<string, number>();
  const display = new Map<string, string>();
  for (const a of attendees) {
    for (const raw of new Set(a.interests.map(normalizeTag))) {
      if (!raw) continue;
      freq.set(raw, (freq.get(raw) ?? 0) + 1);
      if (!display.has(raw)) {
        const original = a.interests.find((t) => normalizeTag(t) === raw) ?? raw;
        display.set(raw, titleCase(original.trim()));
      }
    }
  }

  // each attendee -> their most popular tag (ties broken alphabetically for determinism)
  const buckets = new Map<string, string[]>();
  const general: string[] = [];
  for (const a of attendees) {
    const tags = [...new Set(a.interests.map(normalizeTag))].filter(Boolean);
    if (tags.length === 0) {
      general.push(a.id);
      continue;
    }
    tags.sort((x, y) => (freq.get(y)! - freq.get(x)!) || x.localeCompare(y));
    const primary = tags[0];
    if (!buckets.has(primary)) buckets.set(primary, []);
    buckets.get(primary)!.push(a.id);
  }

  // build clusters, demoting singletons to General
  let clusters: ComputedCluster[] = [];
  for (const [tag, ids] of buckets) {
    if (ids.length < 2) general.push(...ids);
    else clusters.push({ label: display.get(tag) ?? titleCase(tag), theme: null, attendeeIds: ids });
  }

  // largest first; collapse the tail beyond maxClusters - 1 into General
  clusters.sort((a, b) => b.attendeeIds.length - a.attendeeIds.length || a.label.localeCompare(b.label));
  if (clusters.length > maxClusters - 1) {
    const overflow = clusters.slice(maxClusters - 1);
    clusters = clusters.slice(0, maxClusters - 1);
    for (const c of overflow) general.push(...c.attendeeIds);
  }

  if (general.length > 0) {
    clusters.push({
      label: GENERAL_LABEL,
      theme: "Broad interests across the event",
      attendeeIds: general,
    });
  }

  // annotate theme with size
  for (const c of clusters) {
    if (c.theme === null) c.theme = `${c.attendeeIds.length} people focused on ${c.label}`;
  }
  return clusters;
}
