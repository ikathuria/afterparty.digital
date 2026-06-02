import { test } from "node:test";
import assert from "node:assert/strict";
import { computeClusters, type AttendeeLite } from "./cluster.ts";
import { computeMatches } from "./match.ts";

const people: AttendeeLite[] = [
  { id: "1", name: "Ada", title: "CEO", company: "AE", interests: ["AI", "Devtools"] },
  { id: "2", name: "Alan", title: "Researcher", company: "Bletchley", interests: ["AI", "Crypto"] },
  { id: "3", name: "Grace", title: "VP Eng", company: "Univac", interests: ["Devtools", "Compilers"] },
  { id: "4", name: "Kat", title: "Data Sci", company: "NASA", interests: ["Orbital", "AI"] },
  { id: "5", name: "Hedy", title: "Inventor", company: "Freq", interests: ["Signal", "Wireless"] },
  { id: "6", name: "Claude", title: "Fellow", company: "Bell", interests: ["AI", "Info Theory"] },
];

function clusterOfMap(attendees: AttendeeLite[]) {
  const clusters = computeClusters(attendees);
  const m = new Map<string, string>();
  clusters.forEach((c, i) => c.attendeeIds.forEach((id) => m.set(id, String(i))));
  return { clusters, clusterOf: m };
}

test("clusters cover every attendee exactly once", () => {
  const { clusters } = clusterOfMap(people);
  const all = clusters.flatMap((c) => c.attendeeIds).sort();
  assert.deepEqual(all, ["1", "2", "3", "4", "5", "6"]);
});

test("recommends shared-interest people first, with a grounded reason", () => {
  const { clusterOf } = clusterOfMap(people);
  const matches = computeMatches(people, clusterOf, { perAttendee: 3 });
  const adaRecs = matches.get("1")!;
  assert.ok(adaRecs.length > 0);
  // top rec for Ada (AI, Devtools) should be someone who shares a tag
  assert.ok(["2", "3", "4", "6"].includes(adaRecs[0].targetId));
  assert.match(adaRecs[0].reason, /both into/i);
});

test("honesty rule: no reason claims people met or talked", () => {
  const { clusterOf } = clusterOfMap(people);
  const matches = computeMatches(people, clusterOf);
  for (const recs of matches.values()) {
    for (const r of recs) {
      assert.doesNotMatch(r.reason, /\b(met|talked|spoke|chatted|connected with)\b/i, r.reason);
    }
  }
});

test("deterministic: identical input yields identical output", () => {
  const { clusterOf: c1 } = clusterOfMap(people);
  const { clusterOf: c2 } = clusterOfMap(people);
  const a = computeMatches(people, c1);
  const b = computeMatches(people, c2);
  assert.deepEqual([...a.entries()], [...b.entries()]);
});

test("never recommends self", () => {
  const { clusterOf } = clusterOfMap(people);
  const matches = computeMatches(people, clusterOf);
  for (const [id, recs] of matches) {
    assert.ok(recs.every((r) => r.targetId !== id));
  }
});
