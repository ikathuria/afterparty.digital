// Deterministic matchmaking — for each attendee, the people they should reach
// out to and *why*. No API key required; fully reproducible.
//
// Honesty rule: a recommendation is "you should reach out", grounded in shared
// interests / company. It never claims the two people met or spoke.

import { normalizeTag, type AttendeeLite } from "./cluster.ts";

export interface Recommendation {
  targetId: string;
  score: number;
  reason: string;
}

function formatList(items: string[], max = 2): string {
  const xs = items.slice(0, max);
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human, honest reason referencing only real shared attributes. */
function buildReason(
  a: AttendeeLite,
  b: AttendeeLite,
  sharedTagsDisplay: string[],
  sameCompany: boolean,
  sameCluster: boolean,
): string {
  const who = b.title
    ? `${b.title}${b.company ? ` at ${b.company}` : ""}`
    : b.company
      ? `at ${b.company}`
      : null;

  if (sharedTagsDisplay.length > 0) {
    const base = `You're both into ${formatList(sharedTagsDisplay)}`;
    return who ? `${base} — and they're ${who}.` : `${base}.`;
  }
  if (sameCompany && a.company) return `You're both at ${a.company} — worth comparing notes.`;
  if (sameCluster) return who ? `Same crowd as you — ${who}.` : `In the same group as you.`;
  return who ? `Also in your room — ${who}.` : `Also in your room — worth a hello.`;
}

/**
 * Compute up to `perAttendee` recommendations for everyone. Scores by shared
 * interest tags (weighted), same cluster, and same company; always returns the
 * best available people so each page can show real suggestions.
 */
export function computeMatches(
  attendees: AttendeeLite[],
  clusterOf: Map<string, string>,
  opts: { perAttendee?: number } = {},
): Map<string, Recommendation[]> {
  const perAttendee = opts.perAttendee ?? 5;

  // precompute normalized tag sets + a display lookup
  const tagSet = new Map<string, Set<string>>();
  const display = new Map<string, string>();
  for (const a of attendees) {
    const set = new Set<string>();
    for (const raw of a.interests) {
      const n = normalizeTag(raw);
      if (!n) continue;
      set.add(n);
      if (!display.has(n)) display.set(n, titleCase(raw.trim()));
    }
    tagSet.set(a.id, set);
  }

  const result = new Map<string, Recommendation[]>();

  for (const a of attendees) {
    const aTags = tagSet.get(a.id)!;
    const aCluster = clusterOf.get(a.id);

    const scored = attendees
      .filter((b) => b.id !== a.id)
      .map((b) => {
        const bTags = tagSet.get(b.id)!;
        const shared = [...aTags].filter((t) => bTags.has(t));
        const sameCompany = !!a.company && a.company === b.company;
        const sameCluster = !!aCluster && aCluster === clusterOf.get(b.id);
        const score = shared.length * 3 + (sameCluster ? 2 : 0) + (sameCompany ? 1 : 0);
        const sharedDisplay = shared.map((t) => display.get(t) ?? titleCase(t));
        return {
          targetId: b.id,
          score,
          reason: buildReason(a, b, sharedDisplay, sameCompany, sameCluster),
          // deterministic tiebreak material
          _shared: shared.length,
          _name: b.name,
        };
      })
      .sort(
        (x, y) =>
          y.score - x.score || y._shared - x._shared || x._name.localeCompare(y._name),
      )
      .slice(0, perAttendee)
      .map(({ targetId, score, reason }) => ({ targetId, score, reason }));

    result.set(a.id, scored);
  }

  return result;
}
