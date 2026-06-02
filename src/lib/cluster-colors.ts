// Plain module (no "use client") so both the server dashboard page and the
// client RoomGraph can import these.

export const CLUSTER_COLORS = [
  "#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#c084fc",
  "#fb7185", "#22d3ee", "#a3e635",
];
const NO_CLUSTER = "#6b7280";

export function clusterColor(i: number) {
  return i < 0 ? NO_CLUSTER : CLUSTER_COLORS[i % CLUSTER_COLORS.length];
}
