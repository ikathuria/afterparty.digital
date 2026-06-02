"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RoomNode, RoomLink } from "@/lib/dashboard-data";
import { clusterColor } from "@/lib/cluster-colors";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export function RoomGraph({ nodes, links }: { nodes: RoomNode[]; links: RoomLink[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const height = 460;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30" style={{ height }}>
      <ForceGraph2D
        width={width}
        height={height}
        graphData={{ nodes: structuredClone(nodes), links: structuredClone(links) }}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={5}
        linkColor={() => "rgba(255,255,255,0.12)"}
        linkWidth={1}
        cooldownTicks={100}
        nodeCanvasObject={(raw, ctx, scale) => {
          const node = raw as RoomNode & { x: number; y: number };
          const color = clusterColor(node.cluster);
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          if (scale > 1.5) {
            const fontSize = 11 / scale;
            ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(node.name, node.x, node.y + 6);
          }
        }}
      />
    </div>
  );
}
