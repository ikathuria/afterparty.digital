// Database row types, mirroring db/schema.sql.

export type ConnectionKind = "recommended" | "marked" | "confirmed";
export type EventStatus = "draft" | "processing" | "live" | "dissolved";

export interface EventRow {
  id: string;
  name: string;
  slug: string;
  organizer_id: string | null;
  event_date: string | null;
  dissolves_at: string | null;
  status: EventStatus;
  created_at: string;
}

export interface AttendeeRow {
  id: string;
  event_id: string;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  interests: string[];
  socials: Record<string, string>;
  page_token: string;
  created_at: string;
}

export interface ConnectionRow {
  id: string;
  event_id: string;
  source_attendee_id: string;
  target_attendee_id: string;
  kind: ConnectionKind;
  reason: string | null;
  note: string | null;
  created_at: string;
}

export interface ClusterRow {
  id: string;
  event_id: string;
  label: string;
  theme: string | null;
  attendee_ids: string[];
  created_at: string;
}

export interface HighlightRow {
  id: string;
  event_id: string;
  title: string;
  body: string | null;
  source: string | null;
  created_at: string;
}
