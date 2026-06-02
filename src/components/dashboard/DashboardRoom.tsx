"use client";

import { useMemo, useState } from "react";
import { RoomGraph } from "./RoomGraph";
import { clusterColor } from "@/lib/cluster-colors";
import type { RoomNode, RoomLink, RosterPerson } from "@/lib/dashboard-data";

interface Props {
  nodes: RoomNode[];
  links: RoomLink[];
  clusters: { label: string; size: number }[];
  roster: RosterPerson[];
  totalClusters: number;
  topTheme: string | null;
}

export function DashboardRoom({ nodes, links, clusters, roster, totalClusters, topTheme }: Props) {
  const [highlight, setHighlight] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((p) => (highlight === null ? true : p.cluster === highlight))
      .filter((p) =>
        q ? `${p.name} ${p.title ?? ""} ${p.company ?? ""}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roster, query, highlight]);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">The room, mapped</h2>
        <span className="text-sm text-white/50">
          {totalClusters} interest clusters · top theme:{" "}
          <span className="text-white/80">{topTheme ?? "—"}</span>
        </span>
      </div>

      <RoomGraph nodes={nodes} links={links} highlightCluster={highlight} />

      {/* Clickable cluster legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {clusters.map((c, i) => {
          const active = highlight === i;
          return (
            <button
              key={c.label}
              onClick={() => setHighlight(active ? null : i)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                active ? "border-white/40 bg-white/10" : "border-white/10 hover:bg-white/5"
              }`}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: clusterColor(i), boxShadow: `0 0 8px ${clusterColor(i)}` }}
              />
              <span className="text-white/80">{c.label}</span>
              <span className="text-white/40">{c.size}</span>
            </button>
          );
        })}
        {highlight !== null && (
          <button onClick={() => setHighlight(null)} className="rounded-full px-3 py-1 text-sm text-white/50 hover:text-white">
            clear ✕
          </button>
        )}
      </div>

      {/* Searchable attendee table */}
      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Attendees</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, company…"
            className="w-64 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-fuchsia-400/50"
          />
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Cluster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-white/60">
                    {[p.title, p.company].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: clusterColor(p.cluster) }}
                      />
                      <span className="text-white/70">
                        {p.cluster >= 0 ? clusters[p.cluster]?.label : "—"}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-white/40">
                    No attendees match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
