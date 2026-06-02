"use client";

import { useMemo, useState, useTransition } from "react";
import { setConnection } from "@/lib/connections";
import { reachOutHref, reachOutLabel } from "@/lib/reach-out";
import type { PersonLite, Recommendation } from "@/lib/page-data";
import {
  RelationshipGraph,
  type GraphLink,
  type GraphNode,
} from "./RelationshipGraph";

interface Props {
  token: string;
  you: { id: string; name: string };
  initialRecommendations: Recommendation[];
  initialMarked: PersonLite[];
  others: PersonLite[];
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function PersonMeta({ p }: { p: PersonLite }) {
  const meta = [p.title, p.company].filter(Boolean).join(" · ");
  return meta ? <p className="text-sm text-white/60">{meta}</p> : null;
}

export function AfterpartyBoard({
  token,
  you,
  initialRecommendations,
  initialMarked,
  others: initialOthers,
}: Props) {
  const [recs, setRecs] = useState(initialRecommendations);
  const [marked, setMarked] = useState(initialMarked);
  const [others, setOthers] = useState(initialOthers);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const persist = (targetId: string, kind: "marked" | "confirmed", on: boolean) =>
    startTransition(async () => {
      await setConnection(token, targetId, kind, on);
    });

  function toggleConfirm(rec: Recommendation) {
    const next = !rec.confirmed;
    setRecs((rs) => rs.map((r) => (r.id === rec.id ? { ...r, confirmed: next } : r)));
    persist(rec.id, "confirmed", next);
  }

  function addMarked(p: PersonLite) {
    setMarked((m) => [...m, p]);
    setOthers((o) => o.filter((x) => x.id !== p.id));
    setQuery("");
    persist(p.id, "marked", true);
  }

  function removeMarked(p: PersonLite) {
    setMarked((m) => m.filter((x) => x.id !== p.id));
    setOthers((o) => [p, ...o]);
    persist(p.id, "marked", false);
  }

  // --- graph data ---
  const { nodes, links } = useMemo(() => {
    const nodes: GraphNode[] = [{ id: you.id, name: firstName(you.name), group: "you" }];
    const links: GraphLink[] = [];
    for (const r of recs) {
      const group = r.confirmed ? "confirmed" : "recommended";
      nodes.push({ id: r.id, name: firstName(r.name), group });
      links.push({ source: you.id, target: r.id, kind: group });
    }
    for (const m of marked) {
      nodes.push({ id: m.id, name: firstName(m.name), group: "marked" });
      links.push({ source: you.id, target: m.id, kind: "marked" });
    }
    return { nodes, links };
  }, [you, recs, marked]);

  function onNodeClick(id: string) {
    const rec = recs.find((r) => r.id === id);
    if (rec) toggleConfirm(rec);
  }

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return others
      .filter((p) => `${p.name} ${p.title ?? ""} ${p.company ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, others]);

  return (
    <div className="space-y-10">
      {/* Graph */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          <span className="flex items-center gap-1.5"><Dot c="#ffffff" /> You</span>
          <span className="flex items-center gap-1.5"><Dot c="#60a5fa" /> Suggested</span>
          <span className="flex items-center gap-1.5"><Dot c="#34d399" /> Following up</span>
          <span className="flex items-center gap-1.5"><Dot c="#c084fc" /> You added</span>
          <span className="ml-auto text-white/40">tap a suggested person to mark them as a follow-up</span>
        </div>
        <RelationshipGraph nodes={nodes} links={links} onNodeClick={onNodeClick} />
      </section>

      {/* Recommendations */}
      <section>
        <h2 className="text-xl font-semibold">People you should meet</h2>
        <p className="mt-1 text-sm text-white/60">
          The event&apos;s over — these are the connections worth making before it fades.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {recs.map((r) => {
            const href = reachOutHref(r.socials);
            return (
              <div
                key={r.id}
                className={`rounded-2xl border p-4 transition ${
                  r.confirmed
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <PersonMeta p={r} />
                  </div>
                  <button
                    onClick={() => toggleConfirm(r)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      r.confirmed
                        ? "bg-emerald-400 text-emerald-950"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {r.confirmed ? "✓ Following up" : "Follow up"}
                  </button>
                </div>
                {r.reason && <p className="mt-3 text-sm text-white/75">{r.reason}</p>}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-fuchsia-300 hover:text-fuchsia-200"
                  >
                    {reachOutLabel(r.socials)} →
                  </a>
                )}
              </div>
            );
          })}
          {recs.length === 0 && (
            <p className="text-sm text-white/50">No suggestions yet for this room.</p>
          )}
        </div>
      </section>

      {/* Add someone we missed */}
      <section>
        <h2 className="text-xl font-semibold">Someone we missed?</h2>
        <p className="mt-1 text-sm text-white/60">
          Add anyone else from the room you want to remember.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search attendees by name, role, or company…"
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-fuchsia-400/50"
        />
        {searchResults.length > 0 && (
          <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {searchResults.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <PersonMeta p={p} />
                </div>
                <button
                  onClick={() => addMarked(p)}
                  className="rounded-full bg-fuchsia-500/90 px-3 py-1 text-xs font-medium text-white hover:bg-fuchsia-500"
                >
                  + Add
                </button>
              </li>
            ))}
          </ul>
        )}

        {marked.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {marked.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 py-1 pl-3 pr-1.5 text-sm"
              >
                {p.name}
                <button
                  onClick={() => removeMarked(p)}
                  aria-label={`Remove ${p.name}`}
                  className="rounded-full bg-white/10 px-1.5 text-xs text-white/70 hover:bg-white/20"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const Dot = ({ c }: { c: string }) => (
  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }} />
);
