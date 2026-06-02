"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setConnection } from "@/lib/connections";
import { reachOutHref, reachOutLabel } from "@/lib/reach-out";
import { buildIntro, buildVCards, downloadFile, type OutreachPerson } from "@/lib/outreach";
import type { PersonLite, Recommendation } from "@/lib/page-data";
import { RelationshipGraph, type GraphLink, type GraphNode } from "./RelationshipGraph";

interface Props {
  token: string;
  eventName: string;
  you: { id: string; name: string };
  initialRecommendations: Recommendation[];
  initialMarked: PersonLite[];
  others: PersonLite[];
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function PersonMeta({ p }: { p: { title: string | null; company: string | null } }) {
  const meta = [p.title, p.company].filter(Boolean).join(" · ");
  return meta ? <p className="text-sm text-white/60">{meta}</p> : null;
}

export function AfterpartyBoard({
  token,
  eventName,
  you,
  initialRecommendations,
  initialMarked,
  others: initialOthers,
}: Props) {
  const [recs, setRecs] = useState(initialRecommendations);
  const [marked, setMarked] = useState(initialMarked);
  const [others, setOthers] = useState(initialOthers);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const persist = (targetId: string, kind: "marked" | "confirmed", on: boolean) =>
    startTransition(async () => {
      const res = await setConnection(token, targetId, kind, on);
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
    });

  function toggleConfirm(rec: Recommendation) {
    const next = !rec.confirmed;
    setRecs((rs) => rs.map((r) => (r.id === rec.id ? { ...r, confirmed: next } : r)));
    persist(rec.id, "confirmed", next);
    toast[next ? "success" : "message"](
      next ? `Following up with ${firstName(rec.name)} ✦` : `Removed ${firstName(rec.name)} from follow-ups`,
    );
  }

  function addMarked(p: PersonLite) {
    setMarked((m) => [...m, p]);
    setOthers((o) => o.filter((x) => x.id !== p.id));
    setQuery("");
    persist(p.id, "marked", true);
    toast.success(`Added ${firstName(p.name)} to your room`);
  }

  function removeMarked(p: PersonLite) {
    setMarked((m) => m.filter((x) => x.id !== p.id));
    setOthers((o) => [p, ...o]);
    persist(p.id, "marked", false);
    toast.message(`Removed ${firstName(p.name)}`);
  }

  async function copyIntro(p: OutreachPerson) {
    try {
      await navigator.clipboard.writeText(buildIntro(you.name, p, eventName));
      toast.success("Intro copied — paste it into a DM or email");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  function saveContacts() {
    const people: OutreachPerson[] = [...recs.filter((r) => r.confirmed), ...marked];
    const pool = people.length > 0 ? people : recs;
    downloadFile("afterparty-connections.vcf", buildVCards(pool));
    toast.success(`Saved ${pool.length} contacts before they dissolve`);
  }

  async function sharePage() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: "My afterparty", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Page link copied");
      }
    } catch {
      /* user dismissed share sheet */
    }
  }

  // unified lookup for the detail panel
  const personById = useMemo(() => {
    const m = new Map<
      string,
      OutreachPerson & { id: string; kind: "rec" | "marked"; confirmed?: boolean }
    >();
    for (const r of recs)
      m.set(r.id, { ...r, kind: "rec", confirmed: r.confirmed });
    for (const p of marked) m.set(p.id, { ...p, reason: null, kind: "marked" });
    return m;
  }, [recs, marked]);

  const selected = selectedId ? personById.get(selectedId) : undefined;

  // graph data
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

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return others
      .filter((p) => `${p.name} ${p.title ?? ""} ${p.company ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, others]);

  const confirmedCount = recs.filter((r) => r.confirmed).length;
  const progress = recs.length > 0 ? Math.round((confirmedCount / recs.length) * 100) : 0;

  return (
    <div className="space-y-10">
      {/* Progress + take-it-with-you */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {confirmedCount} of {recs.length} follow-ups started
            </p>
            <p className="text-xs text-white/50">Reach out before this page dissolves.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveContacts}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              ⬇ Save my connections
            </button>
            <button
              onClick={sharePage}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              ↗ Share
            </button>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-emerald-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {/* Graph */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          <span className="flex items-center gap-1.5"><Dot c="#ffffff" /> You</span>
          <span className="flex items-center gap-1.5"><Dot c="#60a5fa" /> Suggested</span>
          <span className="flex items-center gap-1.5"><Dot c="#34d399" /> Following up</span>
          <span className="flex items-center gap-1.5"><Dot c="#c084fc" /> You added</span>
          <span className="ml-auto text-white/40">tap anyone to see why · hover to trace their links</span>
        </div>
        <RelationshipGraph nodes={nodes} links={links} onNodeClick={(id) => id !== you.id && setSelectedId(id)} />
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
                  r.confirmed ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setSelectedId(r.id)} className="text-left">
                    <p className="font-semibold hover:underline">{r.name}</p>
                    <PersonMeta p={r} />
                  </button>
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
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <button
                    onClick={() => copyIntro(r)}
                    className="font-medium text-fuchsia-300 hover:text-fuchsia-200"
                  >
                    ✦ Copy intro
                  </button>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white/70 hover:text-white"
                    >
                      {reachOutLabel(r.socials)} →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {recs.length === 0 && <p className="text-sm text-white/50">No suggestions yet for this room.</p>}
        </div>
      </section>

      {/* Add someone we missed */}
      <section>
        <h2 className="text-xl font-semibold">Someone we missed?</h2>
        <p className="mt-1 text-sm text-white/60">Add anyone else from the room you want to remember.</p>
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
                <button onClick={() => setSelectedId(p.id)} className="hover:underline">
                  {p.name}
                </button>
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

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          person={selected}
          onClose={() => setSelectedId(null)}
          onCopyIntro={() => copyIntro(selected)}
          onToggleConfirm={
            selected.kind === "rec"
              ? () => toggleConfirm(recs.find((r) => r.id === selected.id)!)
              : undefined
          }
          confirmed={selected.confirmed}
        />
      )}
    </div>
  );
}

function DetailPanel({
  person,
  onClose,
  onCopyIntro,
  onToggleConfirm,
  confirmed,
}: {
  person: OutreachPerson & { id: string };
  onClose: () => void;
  onCopyIntro: () => void;
  onToggleConfirm?: () => void;
  confirmed?: boolean;
}) {
  const href = reachOutHref(person.socials);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#140a1f] p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/50 hover:text-white" aria-label="Close">
          ✕
        </button>
        <p className="text-2xl font-bold">{person.name}</p>
        <PersonMeta p={person} />
        {person.reason && (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            {person.reason}
          </p>
        )}
        <div className="mt-6 space-y-2">
          {onToggleConfirm && (
            <button
              onClick={onToggleConfirm}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium ${
                confirmed ? "bg-emerald-400 text-emerald-950" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {confirmed ? "✓ Following up" : "Mark as follow-up"}
            </button>
          )}
          <button
            onClick={onCopyIntro}
            className="w-full rounded-xl bg-fuchsia-500/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-fuchsia-500"
          >
            ✦ Copy intro message
          </button>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-medium hover:bg-white/20"
            >
              {reachOutLabel(person.socials)} →
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

const Dot = ({ c }: { c: string }) => (
  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }} />
);
