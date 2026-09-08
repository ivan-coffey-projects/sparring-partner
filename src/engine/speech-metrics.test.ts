import { describe, expect, it } from "vitest";
import {
  MONOLOGUE_GAP_SECONDS,
  computeSpeechMetrics,
  countFillers,
  longestMonologueSeconds,
} from "@/engine/speech-metrics";
import type { TranscribedWord } from "@/engine/types";

/** Builds a run of words for one speaker at a steady pace. */
function say(
  speaker: "rep" | "prospect",
  text: string,
  startSeconds: number,
  secondsPerWord = 0.5,
): TranscribedWord[] {
  return text.split(/\s+/).map((word, i) => ({
    text: word,
    speaker,
    startSeconds: startSeconds + i * secondsPerWord,
    endSeconds: startSeconds + (i + 1) * secondsPerWord,
  }));
}

describe("countFillers", () => {
  it("counts single-word fillers", () => {
    expect(countFillers(["um", "the", "uh", "budget"])).toBe(2);
  });

  it("counts a multi-word filler once, not once per word", () => {
    expect(countFillers(["you", "know"])).toBe(1);
  });

  it("does not double-count a filler word inside a filler phrase", () => {
    // "kind of" is one filler; "of" alone is not a filler and "kind" is not
    // counted separately.
    expect(countFillers(["it's", "kind", "of", "slow"])).toBe(1);
  });

  it("ignores punctuation and case", () => {
    expect(countFillers(["Um,", "UH!", "Basically..."])).toBe(3);
  });

  it("counts nothing in clean speech", () => {
    expect(countFillers("what does that cost you today".split(" "))).toBe(0);
  });
});

describe("longestMonologueSeconds", () => {
  it("measures an unbroken stretch", () => {
    expect(longestMonologueSeconds(say("rep", "a b c d", 0))).toBe(2);
  });

  it("survives a pause shorter than the gap tolerance", () => {
    const words = [
      ...say("rep", "a b", 0),
      ...say("rep", "c d", 1 + MONOLOGUE_GAP_SECONDS - 0.5),
    ];
    // One stretch from 0 to 3.5 rather than two of 1s each.
    expect(longestMonologueSeconds(words)).toBeGreaterThan(2);
  });

  it("breaks on a pause longer than the gap tolerance", () => {
    const words = [
      ...say("rep", "a b", 0),
      ...say("rep", "c d", 1 + MONOLOGUE_GAP_SECONDS + 1),
    ];
    expect(longestMonologueSeconds(words)).toBe(1);
  });

  it("breaks when the prospect speaks, however briefly", () => {
    const words = [
      ...say("rep", "a b c", 0),
      ...say("prospect", "mm", 1.5),
      ...say("rep", "d", 2),
    ];
    // The rep's longest run is the 1.5s before the interruption.
    expect(longestMonologueSeconds(words)).toBe(1.5);
  });

  it("is zero when the rep never speaks", () => {
    expect(longestMonologueSeconds(say("prospect", "a b", 0))).toBe(0);
  });
});

describe("computeSpeechMetrics", () => {
  it("splits talk time by speaker and excludes silence", () => {
    const words = [
      ...say("rep", "a b c d", 0), // 2s
      ...say("prospect", "e f", 10), // 1s, after 8s of silence
    ];
    const m = computeSpeechMetrics(words);
    expect(m.repSpeakingSeconds).toBe(2);
    expect(m.prospectSpeakingSeconds).toBe(1);
    // 2 / 3 — silence belongs to neither side.
    expect(m.repTalkRatio).toBeCloseTo(0.67, 2);
  });

  it("reports filler rate per 100 rep words", () => {
    const words = say("rep", "um a b uh c d e f g h", 0);
    const m = computeSpeechMetrics(words);
    expect(m.fillerCount).toBe(2);
    expect(m.repWordCount).toBe(10);
    expect(m.fillerRatePer100Words).toBe(20);
  });

  it("counts only rep fillers", () => {
    const words = [
      ...say("rep", "what changed", 0),
      ...say("prospect", "um uh basically", 5),
    ];
    expect(computeSpeechMetrics(words).fillerCount).toBe(0);
  });

  it("computes WPM over speaking time, not elapsed time", () => {
    // 10 words at 0.5s each = 5s of speech, spread across a 60s call.
    const words = [
      ...say("rep", "a b c d e f g h i j", 0),
      ...say("prospect", "k", 59),
    ];
    // 10 words in 5s = 120 wpm, not 10 words in 60s = 10 wpm.
    expect(computeSpeechMetrics(words).repWordsPerMinute).toBe(120);
  });

  it("returns zeroes rather than NaN for an empty transcript", () => {
    const m = computeSpeechMetrics([]);
    expect(m).toEqual({
      fillerCount: 0,
      fillerRatePer100Words: 0,
      repSpeakingSeconds: 0,
      prospectSpeakingSeconds: 0,
      repTalkRatio: 0,
      longestMonologueSeconds: 0,
      repWordsPerMinute: 0,
      repWordCount: 0,
    });
  });

  it("returns zeroes rather than NaN when only the prospect speaks", () => {
    const m = computeSpeechMetrics(say("prospect", "a b", 0));
    expect(m.repTalkRatio).toBe(0);
    expect(m.repWordsPerMinute).toBe(0);
    expect(m.fillerRatePer100Words).toBe(0);
  });

  it("does not depend on the order words arrive in", () => {
    const words = [...say("rep", "a b c", 0), ...say("prospect", "d e", 5)];
    const shuffled = [...words].reverse();
    expect(computeSpeechMetrics(shuffled)).toEqual(
      computeSpeechMetrics(words),
    );
  });
});
