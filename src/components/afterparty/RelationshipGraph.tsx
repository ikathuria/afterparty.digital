"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
  recommended: "#60a5fa", // blue
  confirmed: "#34d399", // green
  marked: "#c084fc", // purple
};

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
  const [width, setWidth] = useState(600);
  const height = 360;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
      style={{ height }}
    >
      <ForceGraph2D
        width={width}
        height={height}
        graphData={{ nodes: structuredClone(nodes), links: structuredClone(links) }}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={6}
        linkColor={() => "rgba(255,255,255,0.18)"}
        linkWidth={1.2}
        cooldownTicks={80}
        onNodeClick={(n) => onNodeClick?.(String((n as { id?: string | number }).id))}
        nodeCanvasObject={(raw, ctx, scale) => {
          const node = raw as GraphNode & { x: number; y: number };
          const g = node.group;
          const r = g === "you" ? 8 : 6;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
          ctx.fillStyle = COLORS[g];
          ctx.shadowColor = COLORS[g];
          ctx.shadowBlur = g === "you" ? 18 : 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          const label = node.name;
          const fontSize = Math.max(10, 12 / scale);
          ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(label, node.x!, node.y! + r + 2);
        }}
      />
    </div>
  );
}
