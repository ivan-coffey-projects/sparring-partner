import type { TurnMetrics } from "@/engine/types";

/**
 * Code-computed metrics for a rep message. Deliberately not a model call:
 * monologue detection must be un-charmanble arithmetic.
 */
export function computeTurnMetrics(text: string): TurnMetrics {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const questionCount = (text.match(/\?/g) ?? []).length;
  return { wordCount: words.length, questionCount };
}
