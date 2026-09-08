import type {
  CitationGateResult,
  DroppedCoachingPoint,
  GatedCoachingPoint,
  MethodologyEntryRef,
  RawCoachingPoint,
  TranscriptTurnRef,
} from "@/engine/types";

/**
 * The citation gate. The grader may only make a point it can trace to
 * (a) a real numbered methodology entry and (b) a quote that actually
 * appears in the cited transcript turn. Anything it can't cite is dropped —
 * the system prefers silence over invented coaching.
 */
export function gateCoachingPoints(
  points: RawCoachingPoint[],
  entries: MethodologyEntryRef[],
  turns: TranscriptTurnRef[],
): CitationGateResult {
  const entriesByNumber = new Map(entries.map((e) => [e.number, e]));
  const turnsByIdx = new Map(turns.map((t) => [t.idx, t]));

  const kept: GatedCoachingPoint[] = [];
  const dropped: DroppedCoachingPoint[] = [];

  for (const point of points) {
    const entry = entriesByNumber.get(point.methodologyEntryNumber.trim());
    if (!entry) {
      dropped.push({ point, reason: "unknown_entry" });
      continue;
    }
    const turn = turnsByIdx.get(point.turnIdx);
    if (!turn) {
      dropped.push({ point, reason: "bad_turn_ref" });
      continue;
    }
    if (!quoteAppearsIn(point.transcriptQuote, turn.text)) {
      dropped.push({ point, reason: "quote_not_found" });
      continue;
    }
    kept.push({
      ...point,
      methodologyEntryId: entry.id,
      methodologyEntryTitle: entry.title,
      methodologyEntryText: entry.text,
    });
  }

  return { kept, dropped };
}

const QUOTE_SIMILARITY_THRESHOLD = 0.85;

/**
 * Normalized containment check with a fuzzy fallback: models trim ellipses,
 * fix typos, or collapse whitespace when quoting. Exact (normalized)
 * substring passes; otherwise the best token-window overlap must clear 0.85.
 */
export function quoteAppearsIn(quote: string, turnText: string): boolean {
  const normalizedQuote = normalize(quote);
  const normalizedTurn = normalize(turnText);
  if (normalizedQuote.length === 0) return false;
  if (normalizedTurn.includes(normalizedQuote)) return true;

  const quoteTokens = normalizedQuote.split(" ");
  const turnTokens = normalizedTurn.split(" ");
  if (quoteTokens.length > turnTokens.length) {
    return (
      tokenOverlap(quoteTokens, turnTokens) >= QUOTE_SIMILARITY_THRESHOLD
    );
  }

  let best = 0;
  for (let i = 0; i + quoteTokens.length <= turnTokens.length; i++) {
    const window = turnTokens.slice(i, i + quoteTokens.length);
    best = Math.max(best, tokenOverlap(quoteTokens, window));
    if (best >= QUOTE_SIMILARITY_THRESHOLD) return true;
  }
  return false;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, " ")
    .replace(/\.{3,}/g, " ")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fraction of `a` tokens that appear in `b` (multiset intersection). */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const token of b) {
    pool.set(token, (pool.get(token) ?? 0) + 1);
  }
  let hits = 0;
  for (const token of a) {
    const available = pool.get(token) ?? 0;
    if (available > 0) {
      hits++;
      pool.set(token, available - 1);
    }
  }
  return hits / a.length;
}
