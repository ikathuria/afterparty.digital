import Link from "next/link";
import { db } from "@/lib/db";

// Always fetch the current demo links at request time (don't bake at build).
export const dynamic = "force-dynamic";

// Pull live demo links from the seeded event. Prefers the real DeveloperWeek
// event; "see a live afterparty" prefers a recognizable attendee.
async function getDemoLinks() {
  try {
    const sql = db();
    const evRows = (await sql`
      select id from events where slug in ('dwny-2026', 'smoke-demo')
      order by case slug when 'dwny-2026' then 0 else 1 end limit 1
    `) as { id: string }[];
    const ev = evRows[0];
    if (!ev) return null;

    const attRows = (await sql`
      select page_token from attendees where event_id = ${ev.id}
      order by case when name = 'Ishani Kathuria' then 0 else 1 end, created_at limit 1
    `) as { page_token: string }[];
    return { attendee: attRows[0]?.page_token ?? null, dashboard: ev.id };
  } catch {
    return null;
  }
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/20 text-sm font-bold text-fuchsia-300">
        {n}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{body}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  unit,
  features,
  highlight = false,
}: {
  name: string;
  price: string;
  unit: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-fuchsia-400/40 bg-fuchsia-500/10 shadow-lg shadow-fuchsia-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{name}</h3>
        {highlight && (
          <span className="rounded-full bg-fuchsia-500/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Most popular
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold">{price}</span>
        <span className="text-sm text-white/50">{unit}</span>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-white/70">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-fuchsia-300">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function Home() {
  const demo = await getDemoLinks();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0613] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-fuchsia-600/30 blur-[120px]" />
        <div className="absolute top-1/2 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[26rem] w-[26rem] rounded-full bg-amber-500/15 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="flex min-h-screen flex-col justify-center py-20">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-fuchsia-300/80">
            afterparty.digital
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[1.05] sm:text-7xl">
            Every event ends.{" "}
            <span className="bg-gradient-to-r from-fuchsia-300 via-pink-300 to-amber-200 bg-clip-text text-transparent">
              The connections shouldn&apos;t.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70">
            Upload your event&apos;s attendee list. Every attendee gets a personal page — who was in
            their room, who they should reach out to, and why — before the moment fades.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-6 py-3 font-medium text-white shadow-lg shadow-fuchsia-500/25 transition hover:opacity-90"
            >
              Start an afterparty →
            </Link>
            {demo?.attendee && (
              <Link
                href={`/p/${demo.attendee}`}
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                See a live afterparty
              </Link>
            )}
            {demo?.dashboard && (
              <Link
                href={`/dashboard/${demo.dashboard}`}
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Organizer view
              </Link>
            )}
          </div>
          <p className="mt-6 text-sm text-white/40">
            80% of connections made at events are lost within 72 hours. This fixes that — honestly.
          </p>
        </section>

        {/* How it works */}
        <section className="pb-24">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Step n={1} title="Upload your artifacts" body="An attendee list is all it takes — CSV or JSON, two minutes." />
            <Step n={2} title="AI maps the room" body="We cluster the event by interest and find who each person should meet, and why." />
            <Step n={3} title="Everyone gets their page" body="A personal, beautiful, time-limited afterparty page. It dissolves in 30 days." />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-semibold">For attendees</h3>
              <p className="mt-2 text-sm text-white/60">
                The people worth meeting, a copy-ready intro for each, and a graph of your room you can
                edit and take with you.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-semibold">For organizers</h3>
              <p className="mt-2 text-sm text-white/60">
                The first real map of connection at your event — density, clusters, and follow-ups
                started. ROI beyond attendance numbers.
              </p>
            </div>
          </div>

          {/* Pricing */}
          <h2 className="mt-20 text-2xl font-bold">Pricing</h2>
          <p className="mt-1 text-sm text-white/60">The organizer pays. Every attendee gets it free.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <PriceCard
              name="Free"
              price="$0"
              unit="up to 50 attendees"
              features={["Personal afterparty pages", "AI matchmaking & clusters", "30-day dissolve"]}
            />
            <PriceCard
              name="Pro"
              price="$299"
              unit="per event"
              highlight
              features={[
                "Unlimited attendees",
                "Organizer ROI dashboard",
                "Connection-density & cluster analytics",
                "Sponsor / session reports",
              ]}
            />
            <PriceCard
              name="Enterprise"
              price="Custom"
              unit="annual"
              features={["White-labeled pages", "CRM integration", "Year-round community tools", "SSO & SLAs"]}
            />
          </div>

          <p className="mt-10 text-sm text-white/40">
            We never claim who you actually met — only who&apos;s worth meeting. The page dissolves in
            30 days; the relationships don&apos;t have to.
          </p>
        </section>
      </div>
    </main>
  );
}
