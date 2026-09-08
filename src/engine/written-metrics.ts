import type { WrittenMetrics } from "@/engine/types";
import { computeTurnMetrics } from "@/engine/metrics";

/**
 * Code-computed metrics for a written rep message. Deliberately not a model
 * call: length bands, spam triggers, reading grade, and self-focus must be
 * un-charmable arithmetic. Thresholds that consume these live in
 * `src/engine/channels.ts`; the evidence lives in docs/research.
 */

/** Classic spam-filter trigger phrases (docs/research/email-channel.md §B5). */
const SPAM_TRIGGERS = [
  "free",
  "guarantee",
  "guaranteed",
  "act now",
  "limited time",
  "100%",
  "no obligation",
  "risk-free",
  "risk free",
  "winner",
  "urgent",
  "exclusive deal",
  "best price",
  "once in a lifetime",
  "double your",
  "click here",
  "buy now",
  "order now",
  "special promotion",
  "no strings attached",
] as const;

/**
 * Value-free bump phrases. Gong's 304K follow-up study measured "Thoughts?"
 * at −20% meetings booked, "never heard back" −14%, "following up" −5%
 * (docs/research/email-channel.md §B6); "just checking in" is a measured
 * reply-killer over SMS too (docs/research/sms-channel.md §A5).
 */
const GUILT_TRIP_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "just following up", pattern: /\bjust following up\b/i },
  { label: "just checking in", pattern: /\bjust (checking|touching base|circling back)\b/i },
  { label: "following up on my", pattern: /\bfollowing up on my (last |previous )?(email|message|text|note)\b/i },
  { label: "never heard back", pattern: /\b(never|haven'?t) heard (back|from you)\b/i },
  { label: "bumping this", pattern: /\b(just )?bumping this\b/i },
  { label: "any thoughts", pattern: /\bany thoughts\b|^thoughts\?$/im },
  { label: "did you get my", pattern: /\bdid you (get|see|receive) my\b/i },
  { label: "circling back", pattern: /\bcircling back\b/i },
  { label: "per my last", pattern: /\bper my (last|previous)\b/i },
];

const SELF_PATTERN =
  /\b(i|i'm|i've|i'll|i'd|me|my|mine|we|we're|we've|we'll|our|ours|us)\b/gi;
const YOU_PATTERN = /\b(you|you're|you've|you'll|you'd|your|yours)\b/gi;

const LINK_PATTERN = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function findSpamTriggers(text: string): string[] {
  const lower = text.toLowerCase();
  return SPAM_TRIGGERS.filter((trigger) => {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower);
  });
}

export function findGuiltTripPhrases(text: string): string[] {
  return GUILT_TRIP_PATTERNS.filter((g) => g.pattern.test(text)).map(
    (g) => g.label,
  );
}

/** Vowel-group syllable estimate; the standard heuristic for FK grade. */
function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:ed|es|e)$/, "");
  const groups = stripped.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch-Kincaid grade level. Research target for sales email is grade ≤5–6
 * (Boomerang 40M: 3rd-grade +36% response; Lavender: grade 3–5 +67% replies —
 * docs/research/email-channel.md §B2).
 */
export function fleschKincaidGrade(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return 0;
  const sentences = Math.max(
    1,
    (text.match(/[.!?]+(?=\s|$)/g) ?? []).length || 1,
  );
  const syllables = words.reduce((acc, w) => acc + estimateSyllables(w), 0);
  const grade =
    0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/**
 * I/we-vs-you ratio, 0..1. High = the message is about the sender. Gong
 * coaches removing "I" statements; first-sentence self-focus reduces replies
 * (docs/research/email-channel.md §B3). Returns 0.5 when neither appears.
 */
export function selfFocusRatio(text: string): number {
  const self = countMatches(text, SELF_PATTERN);
  const you = countMatches(text, YOU_PATTERN);
  if (self + you === 0) return 0.5;
  return Math.round((self / (self + you)) * 100) / 100;
}

export function computeWrittenMetrics(
  text: string,
  subject?: string,
): WrittenMetrics {
  const base = computeTurnMetrics(text);
  const metrics: WrittenMetrics = {
    ...base,
    charCount: text.trim().length,
    linkCount: countMatches(text, LINK_PATTERN),
    emojiCount: countMatches(text, /\p{Extended_Pictographic}/gu),
    exclamationCount: countMatches(text, /!/g),
    allCapsWords: (text.match(/\b[A-Z]{3,}\b/g) ?? []).filter(
      (w) => !/^(SMS|CEO|CFO|CTO|VP|ROI|API|FAQ|PDF|ASAP|URL)$/.test(w),
    ).length,
    spamTriggerHits: findSpamTriggers(text),
    guiltTripHits: findGuiltTripPhrases(text),
    readingGrade: fleschKincaidGrade(text),
    selfFocusRatio: selfFocusRatio(text),
  };
  if (subject !== undefined) {
    const trimmed = subject.trim();
    metrics.subject = {
      charCount: trimmed.length,
      wordCount: trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length,
      spamTriggerHits: findSpamTriggers(trimmed),
      isQuestion: trimmed.endsWith("?"),
    };
  }
  return metrics;
}
