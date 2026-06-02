"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export type GraphGroup = "you" | "recommended" | "confirmed" | "marked";

export interface GraphNode {
  id: string;
  name: string;
  group: GraphGroup;
}
export interface GraphLink {
  source: string;
  target: string;
  kind: GraphGroup;
}

const COLORS: Record<GraphGroup, string> = {
  you: "#ffffff",
  recommended: "#60a5fa",
  confirmed: "#34d399",
  marked: "#c084fc",
};

function endId(v: unknown): string {
  return typeof v === "object" && v !== null ? String((v as { id: string }).id) : String(v);
}

export function RelationshipGraph({
  nodes,
  links,
  onNodeClick,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [width, setWidth] = useState(600);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const height = 380;

  // neighbor map from the (immutable) props links
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) {
      if (!m.has(l.source)) m.set(l.source, new Set());
      if (!m.has(l.target)) m.set(l.target, new Set());
      m.get(l.source)!.add(l.target);
      m.get(l.target)!.add(l.source);
    }
    return m;
  }, [links]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isLit = (id: string) =>
    !hoverId || id === hoverId || neighbors.get(hoverId)?.has(id);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
      style={{ height }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={{ nodes: structuredClone(nodes), links: structuredClone(links) }}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={6}
        linkWidth={(l: { source?: unknown; target?: unknown }) =>
          hoverId && (endId(l.source) === hoverId || endId(l.target) === hoverId) ? 2.2 : 1.2
        }
        linkColor={(l: { source?: unknown; target?: unknown }) =>
          hoverId && (endId(l.source) === hoverId || endId(l.target) === hoverId)
            ? "rgba(255,255,255,0.5)"
            : "rgba(255,255,255,0.12)"
        }
        cooldownTicks={80}
        onEngineStop={() => fgRef.current?.zoomToFit?.(400, 50)}
        onNodeHover={(n: { id?: string | number } | null) => setHoverId(n ? String(n.id) : null)}
        onNodeClick={(n) => onNodeClick?.(String((n as { id?: string | number }).id))}
        nodeCanvasObject={(raw, ctx, scale) => {
          const node = raw as GraphNode & { x: number; y: number };
          const g = node.group;
          const lit = isLit(node.id);
          const r = g === "you" ? 8 : 6;
          ctx.globalAlpha = lit ? 1 : 0.18;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = COLORS[g];
          ctx.shadowColor = COLORS[g];
          ctx.shadowBlur = lit ? (g === "you" ? 18 : 10) : 0;
          ctx.fill();
          ctx.shadowBlur = 0;

          const fontSize = Math.max(10, 12 / scale);
          ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(node.name, node.x, node.y + r + 2);
          ctx.globalAlpha = 1;
        }}
      />
    </div>
  );
}
