// AI layer (Milestone 3): clustering, matchmaking, follow-up copy via Claude.
//
// The honesty rule applies to every prompt here: never assert that two
// attendees met or talked. Output is strictly recommendations ("you should
// reach out") grounded in real attendee attributes.

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Lazily-constructed Anthropic client (avoids throwing at import time). */
export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Model selection — see PLAN.md tech stack.
export const MODELS = {
  generate: "claude-opus-4-8",
  cluster: "claude-haiku-4-5",
} as const;
