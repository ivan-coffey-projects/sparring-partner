import type { SpeechMetrics } from "@/engine/types";

/**
 * H6 agreement scoring — docs/research/voice-channel.md.
 *
 * The thresholds below are pre-registered: they were fixed before any
 * recording was annotated, so the result cannot be re-read after the fact.
 * Do not adjust them to make a run pass. If the metrics miss, the recorded
 * outcome is that they are reported to the rep as directional and excluded
 * from the score — that is a finding, not a failure.
 */
export const FILLER_TOLERANCE_FRACTION = 0.15;
export const TALK_RATIO_TOLERANCE_POINTS = 5;

/**
 * Both bars are inclusive, but the errors are floating-point subtractions:
 * 0.55 - 0.5 is 5.000000000000004 percentage points, which would put a turn
 * sitting exactly on the threshold outside it. Compare with a tolerance far
 * smaller than any real measurement difference.
 */
const EPSILON = 1e-9;

/** What a human annotator records for one turn. */
export interface SpeechAnnotation {
  /** Identifies the recording, so a disagreement can be listened to again. */
  turnId: string;
  fillerCount: number;
  /** Rep share of speaking time, 0..1 — the same quantity the engine computes. */
  repTalkRatio: number;
  longestMonologueSeconds: number;
}

export interface TurnAgreement {
  turnId: string;
  fillerCountHuman: number;
  fillerCountComputed: number;
  /** Computed minus human, as a fraction of the human count. */
  fillerRelativeError: number;
  fillerWithinTolerance: boolean;
  talkRatioHuman: number;
  talkRatioComputed: number;
  /** Computed minus human, in percentage points. */
  talkRatioErrorPoints: number;
  talkRatioWithinTolerance: boolean;
  longestMonologueHuman: number;
  longestMonologueComputed: number;
}

export interface AgreementReport {
  turns: TurnAgreement[];
  turnCount: number;
  fillerWithinToleranceCount: number;
  talkRatioWithinToleranceCount: number;
  /** Mean absolute relative error on filler counts. */
  meanAbsoluteFillerError: number;
  /** Mean absolute error on talk ratio, in percentage points. */
  meanAbsoluteTalkRatioErrorPoints: number;
  /**
   * The pre-registered verdict. `scored` only when BOTH metrics clear their
   * bar across the set; otherwise the metrics ship as directional.
   */
  verdict: "scored" | "directional";
  /** Plain-language reasons the verdict came out as it did. */
  reasons: string[];
}

/**
 * Compares computed metrics against a human annotator's, turn by turn, and
 * applies the pre-registered thresholds to the set as a whole.
 *
 * A turn with zero human fillers cannot have a relative error, so it counts as
 * agreeing only when the engine also found zero. Scoring it any other way would
 * either divide by zero or quietly forgive a false positive.
 */
export function scoreAgreement(
  pairs: Array<{ annotation: SpeechAnnotation; computed: SpeechMetrics }>,
): AgreementReport {
  const turns: TurnAgreement[] = pairs.map(({ annotation, computed }) => {
    const fillerRelativeError =
      annotation.fillerCount === 0
        ? computed.fillerCount === 0
          ? 0
          : Number.POSITIVE_INFINITY
        : (computed.fillerCount - annotation.fillerCount) /
          annotation.fillerCount;
    const talkRatioErrorPoints =
      (computed.repTalkRatio - annotation.repTalkRatio) * 100;

    return {
      turnId: annotation.turnId,
      fillerCountHuman: annotation.fillerCount,
      fillerCountComputed: computed.fillerCount,
      fillerRelativeError,
      fillerWithinTolerance:
        Math.abs(fillerRelativeError) <= FILLER_TOLERANCE_FRACTION + EPSILON,
      talkRatioHuman: annotation.repTalkRatio,
      talkRatioComputed: computed.repTalkRatio,
      talkRatioErrorPoints,
      talkRatioWithinTolerance:
        Math.abs(talkRatioErrorPoints) <= TALK_RATIO_TOLERANCE_POINTS + EPSILON,
      longestMonologueHuman: annotation.longestMonologueSeconds,
      longestMonologueComputed: computed.longestMonologueSeconds,
    };
  });

  const turnCount = turns.length;
  const fillerWithinToleranceCount = turns.filter(
    (t) => t.fillerWithinTolerance,
  ).length;
  const talkRatioWithinToleranceCount = turns.filter(
    (t) => t.talkRatioWithinTolerance,
  ).length;

  // A turn the engine missed entirely has infinite relative error; it must not
  // swallow the mean, so summarise on the finite ones and let the count of
  // in-tolerance turns carry the misses.
  const finiteFillerErrors = turns
    .map((t) => Math.abs(t.fillerRelativeError))
    .filter((e) => Number.isFinite(e));

  const reasons: string[] = [];
  const fillerPasses =
    turnCount > 0 && fillerWithinToleranceCount === turnCount;
  const talkRatioPasses =
    turnCount > 0 && talkRatioWithinToleranceCount === turnCount;

  if (turnCount === 0) reasons.push("No annotated turns were supplied.");
  if (!fillerPasses && turnCount > 0) {
    reasons.push(
      `Filler count missed +/-${FILLER_TOLERANCE_FRACTION * 100}% on ` +
        `${turnCount - fillerWithinToleranceCount} of ${turnCount} turns.`,
    );
  }
  if (!talkRatioPasses && turnCount > 0) {
    reasons.push(
      `Talk ratio missed +/-${TALK_RATIO_TOLERANCE_POINTS} points on ` +
        `${turnCount - talkRatioWithinToleranceCount} of ${turnCount} turns.`,
    );
  }
  if (fillerPasses && talkRatioPasses) {
    reasons.push("Both metrics cleared their pre-registered bar.");
  }

  return {
    turns,
    turnCount,
    fillerWithinToleranceCount,
    talkRatioWithinToleranceCount,
    meanAbsoluteFillerError:
      finiteFillerErrors.length === 0
        ? 0
        : round3(
            finiteFillerErrors.reduce((a, b) => a + b, 0) /
              finiteFillerErrors.length,
          ),
    meanAbsoluteTalkRatioErrorPoints:
      turnCount === 0
        ? 0
        : round3(
            turns.reduce((a, t) => a + Math.abs(t.talkRatioErrorPoints), 0) /
              turnCount,
          ),
    verdict: fillerPasses && talkRatioPasses ? "scored" : "directional",
    reasons,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
