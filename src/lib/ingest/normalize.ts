import { anthropic, MODELS } from "@/lib/ai";
import type { ParsedAttendee } from "./index";

/**
 * Fill in `interests` for attendees that arrived without any, by inferring
 * tags from their title/company/bio with Claude. Honesty rule: these are
 * descriptive interest tags, never claims about who anyone met.
 *
 * Graceful: if ANTHROPIC_API_KEY is unset, or the call fails, the attendees
 * are returned unchanged so ingestion never blocks on AI.
 */
export async function inferMissingInterests(
  attendees: ParsedAttendee[],
): Promise<ParsedAttendee[]> {
  if (!process.env.ANTHROPIC_API_KEY) return attendees;

  const targets = attendees
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.interests.length === 0 && (a.title || a.company || a.bio));

  if (targets.length === 0) return attendees;

  const roster = targets.map(({ a, i }) => ({
    i,
    title: a.title ?? "",
    company: a.company ?? "",
    bio: a.bio ?? "",
  }));

  try {
    const msg = await anthropic().messages.create({
      model: MODELS.cluster,
      max_tokens: 4096,
      system:
        "You tag event attendees with 2-4 concise lowercase interest/topic tags " +
        "(e.g. 'ai infra', 'devtools', 'climate', 'fintech') inferred ONLY from their " +
        "title, company, and bio. Never invent facts. Return strict JSON: " +
        '{"tags": {"<index>": ["tag", ...]}}. Use the provided integer indices as keys.',
      messages: [{ role: "user", content: JSON.stringify(roster) }],
    });

    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return attendees;
    const parsed = JSON.parse(text.text) as { tags: Record<string, string[]> };

    const out = attendees.map((a) => ({ ...a }));
    for (const [idx, tags] of Object.entries(parsed.tags ?? {})) {
      const n = Number(idx);
      if (out[n] && Array.isArray(tags)) out[n].interests = tags.slice(0, 4);
    }
    return out;
  } catch {
    return attendees; // never block ingestion on AI
  }
}
