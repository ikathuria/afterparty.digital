/** Best single "reach out" URL for a person, from their socials. Pure — safe
 *  to import in client components. */
export function reachOutHref(socials: Record<string, string>): string | null {
  return (
    socials.linkedin ||
    socials.twitter ||
    (socials.email ? `mailto:${socials.email}` : null) ||
    socials.website ||
    null
  );
}

export function reachOutLabel(socials: Record<string, string>): string {
  if (socials.linkedin) return "Connect on LinkedIn";
  if (socials.twitter) return "Say hi on X";
  if (socials.email) return "Send an email";
  if (socials.website) return "Visit site";
  return "Reach out";
}
