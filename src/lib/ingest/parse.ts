import Papa from "papaparse";
import type { ParsedAttendee } from "./index";

// ---------------------------------------------------------------------------
// Column mapping. Real-world attendee exports (Luma, Eventbrite, Sheets, CRM
// dumps) use wildly inconsistent headers. We normalize each header to a
// canonical field by matching against a synonym list.
// ---------------------------------------------------------------------------

/** Lowercase, strip punctuation/underscores, collapse whitespace. */
function normHeader(h: string): string {
  return h
    .replace(/^﻿/, "") // strip BOM
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Field =
  | "name"
  | "first_name"
  | "last_name"
  | "title"
  | "company"
  | "bio"
  | "interests"
  | "twitter"
  | "linkedin"
  | "github"
  | "website"
  | "email";

// Order matters only within a field's own synonym list; the first matching
// header wins per field.
const SYNONYMS: Record<Field, string[]> = {
  name: ["name", "full name", "fullname", "attendee name", "display name", "your name"],
  first_name: ["first name", "firstname", "given name", "first"],
  last_name: ["last name", "lastname", "surname", "family name", "last"],
  title: ["title", "job title", "jobtitle", "role", "position", "headline", "occupation", "specialty", "speciality"],
  company: ["company", "organization", "organisation", "employer", "org", "workplace", "company name"],
  bio: ["bio", "about", "description", "summary", "blurb", "intro", "introduction"],
  interests: ["interests", "tags", "topics", "interested in", "skills", "focus", "expertise", "looking for"],
  twitter: ["twitter", "x", "twitter x", "twitter handle", "x handle"],
  linkedin: ["linkedin", "linked in", "linkedin url", "linkedin profile"],
  github: ["github", "git hub", "github url", "gh"],
  website: ["website", "site", "url", "homepage", "personal site", "web"],
  email: ["email", "email address", "e mail", "mail"],
};

/** Map raw header names → { Field: originalHeader } for the headers present. */
function buildFieldMap(headers: string[]): Partial<Record<Field, string>> {
  const normalized = headers.map((h) => ({ raw: h, norm: normHeader(h) }));
  const map: Partial<Record<Field, string>> = {};
  const claimed = new Set<string>(); // raw headers already assigned to a field

  // Pass 1: exact synonym matches. Claiming here prevents a broad synonym like
  // "name" from later swallowing a more specific header like "first name".
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    const hit = normalized.find((h) => !claimed.has(h.raw) && SYNONYMS[field].includes(h.norm));
    if (hit) {
      map[field] = hit.raw;
      claimed.add(hit.raw);
    }
  }

  // Pass 2: substring fallback over only still-unclaimed headers
  // (e.g. "speaker company name" → company).
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    if (field in map) continue;
    const hit = normalized.find(
      (h) => !claimed.has(h.raw) && SYNONYMS[field].some((s) => h.norm.includes(s)),
    );
    if (hit) {
      map[field] = hit.raw;
      claimed.add(hit.raw);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Value extraction helpers
// ---------------------------------------------------------------------------

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function splitList(v: string): string[] {
  return v
    .split(/[,;|•\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSocial(field: "twitter" | "linkedin" | "github" | "website", v: string): string {
  const raw = v.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  switch (field) {
    case "twitter":
      return `https://x.com/${raw.replace(/^@/, "")}`;
    case "github":
      return `https://github.com/${raw.replace(/^@/, "")}`;
    case "linkedin":
      return raw.startsWith("linkedin.com") ? `https://${raw}` : `https://linkedin.com/in/${raw}`;
    case "website":
      return `https://${raw}`;
  }
}

/** Turn one raw record into a ParsedAttendee, or null if it has no usable name. */
export function mapRecord(
  record: Record<string, unknown>,
  fieldMap: Partial<Record<Field, string>>,
): ParsedAttendee | null {
  const get = (f: Field): string => (fieldMap[f] ? clean(record[fieldMap[f]!]) : "");

  let name = get("name");
  if (!name) {
    name = [get("first_name"), get("last_name")].filter(Boolean).join(" ").trim();
  }
  if (!name) return null; // a row without a name is not an attendee

  const socials: Record<string, string> = {};
  for (const s of ["twitter", "linkedin", "github", "website"] as const) {
    const val = normalizeSocial(s, get(s));
    if (val) socials[s] = val;
  }
  const email = get("email");
  if (email) socials.email = email;

  return {
    name,
    title: get("title") || null,
    company: get("company") || null,
    bio: get("bio") || null,
    interests: get("interests") ? splitList(get("interests")) : [],
    socials,
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

function dedupe(rows: ParsedAttendee[]): ParsedAttendee[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = (r.socials.email || r.name).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseCsv(text: string): ParsedAttendee[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h, // keep raw; we map ourselves
  });
  const headers = result.meta.fields ?? [];
  const fieldMap = buildFieldMap(headers);
  const rows = result.data
    .map((r) => mapRecord(r, fieldMap))
    .filter((r): r is ParsedAttendee => r !== null);
  return dedupe(rows);
}

export function parseJson(text: string): ParsedAttendee[] {
  const data = JSON.parse(text);
  const arr: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { attendees?: unknown }).attendees)
      ? ((data as { attendees: Record<string, unknown>[] }).attendees)
      : [];
  if (arr.length === 0) return [];
  const headers = Object.keys(arr[0]);
  const fieldMap = buildFieldMap(headers);
  const rows = arr
    .map((r) => mapRecord(r, fieldMap))
    .filter((r): r is ParsedAttendee => r !== null);
  return dedupe(rows);
}

/** Dispatch on filename extension, with a content sniff fallback. */
export function parseAttendeeFile(fileName: string, text: string): ParsedAttendee[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return parseJson(text);
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return parseCsv(text);
  // Unknown extension: sniff.
  const trimmed = text.trimStart();
  return trimmed.startsWith("[") || trimmed.startsWith("{") ? parseJson(text) : parseCsv(text);
}
