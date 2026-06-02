import { randomBytes } from "node:crypto";

/**
 * Short, URL-safe, unguessable token for a per-attendee afterparty page.
 * 16 base64url chars ≈ 96 bits of entropy — collision-safe at event scale and
 * not enumerable. Server-only (used during ingestion).
 */
export function generatePageToken(): string {
  return randomBytes(12).toString("base64url"); // 12 bytes -> 16 chars
}
