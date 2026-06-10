// Ingestion layer (Milestone 2): parse an uploaded attendee list (CSV/JSON)
// into normalized attendee records. Only the attendee-list path is real —
// Discord / photos / recordings are intentionally not implemented (no
// interaction data is available, and faking it would break the honesty rule).

import type { AttendeeRow } from "@/lib/supabase/types";

/** A normalized attendee, before it is assigned an id / page_token / event_id. */
export type ParsedAttendee = Pick<
  AttendeeRow,
  "name" | "title" | "company" | "bio" | "interests" | "socials"
>;
