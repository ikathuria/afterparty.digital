import type { Metadata } from "next";
import { getDashboard } from "@/lib/dashboard-data";
import { RoomGraph } from "@/components/dashboard/RoomGraph";
import { clusterColor } from "@/lib/cluster-colors";

export const metadata: Metadata = { title: "Organizer dashboard · afterparty.digital" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0613] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[40rem] w-[40rem] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />
      </div>
      <div className="mx-auto max-w-5xl px-6 py-14">{children}</div>
    </main>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm font-medium text-white/80">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-white/50">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDashboard(id);

  if (!data.found) {
    return (
      <Shell>
        <div className="py-24 text-center">
          <h1 className="text-3xl font-bold">Dashboard not found</h1>
          <p className="mt-3 text-white/60">This event link is invalid or has been removed.</p>
        </div>
      </Shell>
    );
  }

  const { event, stats, clusters = [], graph } = data;

  return (
    <Shell>
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-fuchsia-300/80">
          Organizer dashboard
        </p>
        <h1 className="mt-2 text-4xl font-extrabold">{event!.name}</h1>
        <p className="mt-2 max-w-2xl text-white/70">
          The first real map of human connection at your event — not attendance, but who&apos;s
          worth connecting to whom.
        </p>
      </header>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={String(stats!.attendees)} label="In the room" sub="attendees" />
        <Stat value={`${stats!.density}%`} label="Connection density" sub="of all possible pairs mapped" />
        <Stat value={String(stats!.mappedConnections)} label="Connections mapped" sub="suggested introductions" />
        <Stat value={String(stats!.followUps)} label="Follow-ups started" sub="attendees acted on a match" />
      </section>

      {/* Graph */}
      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">The room, mapped</h2>
          <span className="text-sm text-white/50">
            {stats!.clusters} interest clusters · top theme:{" "}
            <span className="text-white/80">{stats!.topTheme ?? "—"}</span>
          </span>
        </div>
        <RoomGraph nodes={graph!.nodes} links={graph!.links} />

        {/* Cluster legend */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {clusters.map((c, i) => (
            <span key={c.label} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: clusterColor(i), boxShadow: `0 0 8px ${clusterColor(i)}` }}
              />
              <span className="text-white/80">{c.label}</span>
              <span className="text-white/40">{c.size}</span>
            </span>
          ))}
        </div>
      </section>

      <footer className="mt-14 border-t border-white/10 pt-6 text-xs text-white/40">
        Connections shown are AI-suggested introductions from the attendee list — not a record of who
        spoke. Real per-account SSO &amp; CRM export are part of the enterprise roadmap.
      </footer>
    </Shell>
  );
}
