import { describe, expect, it } from "vitest";
import {
  FILLER_TOLERANCE_FRACTION,
  TALK_RATIO_TOLERANCE_POINTS,
  scoreAgreement,
  type SpeechAnnotation,
} from "@/engine/speech-metrics-agreement";
import type { SpeechMetrics } from "@/engine/types";

function computed(over: Partial<SpeechMetrics> = {}): SpeechMetrics {
  return {
    fillerCount: 10,
    fillerRatePer100Words: 10,
    repSpeakingSeconds: 30,
    prospectSpeakingSeconds: 30,
    repTalkRatio: 0.5,
    longestMonologueSeconds: 12,
    repWordsPerMinute: 150,
    repWordCount: 100,
    ...over,
  };
}

function annotation(over: Partial<SpeechAnnotation> = {}): SpeechAnnotation {
  return {
    turnId: "t1",
    fillerCount: 10,
    repTalkRatio: 0.5,
    longestMonologueSeconds: 12,
    ...over,
  };
}

describe("scoreAgreement", () => {
  it("returns 'scored' when both metrics agree exactly", () => {
    const report = scoreAgreement([
      { annotation: annotation(), computed: computed() },
    ]);
    expect(report.verdict).toBe("scored");
    expect(report.meanAbsoluteFillerError).toBe(0);
  });

  it("accepts filler error exactly at the tolerance boundary", () => {
    // 10 human, 11.5 computed is 15% — the bar is inclusive.
    const report = scoreAgreement([
      {
        annotation: annotation({ fillerCount: 20 }),
        computed: computed({ fillerCount: 23 }),
      },
    ]);
    expect(Math.abs(report.turns[0].fillerRelativeError)).toBeCloseTo(
      FILLER_TOLERANCE_FRACTION,
      5,
    );
    expect(report.verdict).toBe("scored");
  });

  it("returns 'directional' when filler count drifts past tolerance", () => {
    const report = scoreAgreement([
      {
        annotation: annotation({ fillerCount: 10 }),
        computed: computed({ fillerCount: 13 }),
      },
    ]);
    expect(report.verdict).toBe("directional");
    expect(report.reasons.join(" ")).toContain("Filler count missed");
  });

  it("accepts talk ratio exactly at the tolerance boundary", () => {
    const report = scoreAgreement([
      {
        annotation: annotation({ repTalkRatio: 0.5 }),
        computed: computed({ repTalkRatio: 0.55 }),
      },
    ]);
    expect(report.turns[0].talkRatioErrorPoints).toBeCloseTo(
      TALK_RATIO_TOLERANCE_POINTS,
      5,
    );
    expect(report.verdict).toBe("scored");
  });

  it("returns 'directional' when talk ratio drifts past tolerance", () => {
    const report = scoreAgreement([
      {
        annotation: annotation({ repTalkRatio: 0.5 }),
        computed: computed({ repTalkRatio: 0.6 }),
      },
    ]);
    expect(report.verdict).toBe("directional");
    expect(report.reasons.join(" ")).toContain("Talk ratio missed");
  });

  it("requires EVERY turn to clear the bar, not the average", () => {
    // Nineteen perfect turns cannot carry one badly wrong one.
    const pairs = Array.from({ length: 19 }, (_, i) => ({
      annotation: annotation({ turnId: `t${i}` }),
      computed: computed(),
    }));
    pairs.push({
      annotation: annotation({ turnId: "bad", fillerCount: 10 }),
      computed: computed({ fillerCount: 30 }),
    });
    const report = scoreAgreement(pairs);
    expect(report.turnCount).toBe(20);
    expect(report.fillerWithinToleranceCount).toBe(19);
    expect(report.verdict).toBe("directional");
  });

  it("treats a missed filler on a zero-filler turn as disagreement", () => {
    const report = scoreAgreement([
      {
        annotation: annotation({ fillerCount: 0 }),
        computed: computed({ fillerCount: 2 }),
      },
    ]);
    expect(report.turns[0].fillerWithinTolerance).toBe(false);
    expect(report.verdict).toBe("directional");
  });

  it("agrees on a turn where both found no fillers", () => {
    const report = scoreAgreement([
      {
        annotation: annotation({ fillerCount: 0 }),
        computed: computed({ fillerCount: 0 }),
      },
    ]);
    expect(report.turns[0].fillerRelativeError).toBe(0);
    expect(report.verdict).toBe("scored");
  });

  it("does not let an infinite error swallow the mean", () => {
    const report = scoreAgreement([
      { annotation: annotation(), computed: computed() },
      {
        annotation: annotation({ turnId: "t2", fillerCount: 0 }),
        computed: computed({ fillerCount: 4 }),
      },
    ]);
    expect(Number.isFinite(report.meanAbsoluteFillerError)).toBe(true);
    expect(report.fillerWithinToleranceCount).toBe(1);
  });

  it("is 'directional' with no annotations rather than vacuously 'scored'", () => {
    const report = scoreAgreement([]);
    expect(report.verdict).toBe("directional");
    expect(report.reasons.join(" ")).toContain("No annotated turns");
  });
});
