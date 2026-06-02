// Pure, client-safe helpers for "actionable outreach" + "take it with you".

export interface OutreachPerson {
  name: string;
  title: string | null;
  company: string | null;
  socials: Record<string, string>;
  reason?: string | null;
}

function firstName(name: string) {
  return name.split(" ")[0];
}

/**
 * A warm, copy-ready intro message. Derives a shared-interest hint from the
 * AI reason where possible. Honest: it only ever says you were at the same
 * event and *might* share interests — never that you already met.
 */
export function buildIntro(you: string, person: OutreachPerson, eventName: string): string {
  const me = firstName(you);
  const them = firstName(person.name);

  let hint = "";
  const m = person.reason?.match(/both into ([^—.]+)/i);
  if (m) hint = ` Looks like we're both into ${m[1].trim()}.`;
  else if (person.company) hint = ` I'd love to hear more about what you're building at ${person.company}.`;

  return `Hi ${them} — we were both at ${eventName} but I don't think we got to connect.${hint} Would love to stay in touch and maybe trade notes sometime. — ${me}`;
}

/** vCard 3.0 for one person. */
function toVCard(p: OutreachPerson): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${p.name}`];
  if (p.title || p.company) lines.push(`TITLE:${[p.title, p.company].filter(Boolean).join(", ")}`);
  if (p.company) lines.push(`ORG:${p.company}`);
  if (p.socials.email) lines.push(`EMAIL:${p.socials.email}`);
  for (const key of ["linkedin", "twitter", "github", "website"] as const) {
    if (p.socials[key]) lines.push(`URL;TYPE=${key}:${p.socials[key]}`);
  }
  if (p.reason) lines.push(`NOTE:${p.reason.replace(/\n/g, " ")}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** Concatenated vCards for a set of people (one .vcf file). */
export function buildVCards(people: OutreachPerson[]): string {
  return people.map(toVCard).join("\r\n") + "\r\n";
}

/** Trigger a client-side file download. */
export function downloadFile(filename: string, content: string, type = "text/vcard") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
