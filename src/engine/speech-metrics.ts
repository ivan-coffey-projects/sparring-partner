import type { SpeechMetrics, TranscribedWord } from "@/engine/types";

/**
 * Filler words, as a human annotator would count them. Kept explicit rather
 * than clever: an annotator can read this list and agree or disagree with it,
 * which is what H6 compares against. Multi-word fillers are matched as
 * sequences so "you know" is one filler, not two.
 */
export const FILLER_WORDS: readonly string[] = [
  "um",
  "uh",
  "erm",
  "ah",
  "like",
  "basically",
  "actually",
  "literally",
  "honestly",
  "right",
  "okay",
  "so",
];

export const FILLER_PHRASES: readonly string[][] = [
  ["you", "know"],
  ["i", "mean"],
  ["sort", "of"],
  ["kind", "of"],
  ["you", "see"],
];

/**
 * A gap longer than this between consecutive rep words ends a monologue. Speech
 * pauses constantly; without a tolerance the "longest monologue" would be the
 * longest breath. 2 s is the conventional turn-taking boundary and is the value
 * H6's annotator instructions state, so the human and the code are measuring
 * the same thing.
 */
export const MONOLOGUE_GAP_SECONDS = 2;

function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

/** Total seconds spoken, summing word durations rather than span minus gaps. */
function speakingSeconds(words: TranscribedWord[]): number {
  return words.reduce(
    (total, word) => total + Math.max(0, word.endSeconds - word.startSeconds),
    0,
  );
}

/**
 * Counts fillers, consuming multi-word phrases so their parts are not also
 * counted individually. "Like" inside "sort of like" stays one filler.
 */
export function countFillers(words: string[]): number {
  const tokens = words.map(normalise);
  let count = 0;
  let i = 0;
  while (i < tokens.length) {
    const phrase = FILLER_PHRASES.find((candidate) =>
      candidate.every((part, offset) => tokens[i + offset] === part),
    );
    if (phrase) {
      count += 1;
      i += phrase.length;
      continue;
    }
    if (tokens[i] && FILLER_WORDS.includes(tokens[i])) count += 1;
    i += 1;
  }
  return count;
}

/**
 * The longest unbroken rep stretch. A stretch survives a gap up to
 * `MONOLOGUE_GAP_SECONDS`; anything longer, or any prospect word, ends it.
 * Prospect words matter even when short — being interrupted means the rep was
 * not, in fact, monologuing through it.
 */
export function longestMonologueSeconds(words: TranscribedWord[]): number {
  const ordered = [...words].sort((a, b) => a.startSeconds - b.startSeconds);
  let longest = 0;
  let start: number | null = null;
  let previousEnd = 0;

  for (const word of ordered) {
    if (word.speaker !== "rep") {
      if (start !== null) longest = Math.max(longest, previousEnd - start);
      start = null;
      continue;
    }
    if (start === null || word.startSeconds - previousEnd > MONOLOGUE_GAP_SECONDS) {
      if (start !== null) longest = Math.max(longest, previousEnd - start);
      start = word.startSeconds;
    }
    previousEnd = word.endSeconds;
  }
  if (start !== null) longest = Math.max(longest, previousEnd - start);
  return round2(longest);
}

/**
 * Speech metrics for one call. Pure arithmetic over word timestamps — no model
 * sees this, so a persuasive rep cannot talk the numbers down.
 */
export function computeSpeechMetrics(
  words: TranscribedWord[],
): SpeechMetrics {
  const repWords = words.filter((w) => w.speaker === "rep");
  const prospectWords = words.filter((w) => w.speaker === "prospect");

  const repSpeakingSeconds = round2(speakingSeconds(repWords));
  const prospectSpeakingSeconds = round2(speakingSeconds(prospectWords));
  const totalSpeaking = repSpeakingSeconds + prospectSpeakingSeconds;

  const fillerCount = countFillers(repWords.map((w) => w.text));
  const repWordCount = repWords.length;

  return {
    fillerCount,
    fillerRatePer100Words:
      repWordCount === 0 ? 0 : round2((fillerCount / repWordCount) * 100),
    repSpeakingSeconds,
    prospectSpeakingSeconds,
    repTalkRatio:
      totalSpeaking === 0 ? 0 : round2(repSpeakingSeconds / totalSpeaking),
    longestMonologueSeconds: longestMonologueSeconds(words),
    repWordsPerMinute:
      repSpeakingSeconds === 0
        ? 0
        : Math.round(repWordCount / (repSpeakingSeconds / 60)),
    repWordCount,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
