import type {
  EngagementConfig,
  EngagementTurnResult,
  MoveAnalysis,
  PatienceBand,
  PatienceDelta,
  ReplyDecision,
  WrittenMetrics,
} from "@/engine/types";
import { patienceBand } from "@/engine/patience";

const MIN = 0;
const MAX = 100;

function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface EngagementTurnInput {
  analysis: MoveAnalysis;
  metrics: WrittenMetrics;
  /** True when this is the rep's first message of the thread. */
  isFirstTouch: boolean;
  /** True when the previous rep message got no prospect reply. */
  isFollowUpIntoSilence: boolean;
  /** Simulated minutes since the rep's previous message, if any. */
  minutesSinceLastRepMessage: number | null;
}

/**
 * The engagement state machine — the async channels' patience. Pure: state
 * in, code metrics + analyzer read in, state out. The prospect model never
 * decides how interested it feels. Every rule cites its evidence in
 * `src/engine/channels.ts` / docs/research.
 */
export function applyEngagementTurn(
  current: number,
  input: EngagementTurnInput,
  config: EngagementConfig,
): EngagementTurnResult {
  const { analysis, metrics } = input;
  const written = analysis.written;
  const deltas: PatienceDelta[] = [];

  // Length discipline: per-char drain over the ideal band, plus a flat
  // wall-of-text penalty at the hard threshold.
  if (metrics.charCount > config.idealMaxChars) {
    const over = metrics.charCount - config.idealMaxChars;
    let amount = over * config.perCharPenalty;
    if (metrics.charCount >= config.hardMaxChars) {
      amount += config.wallOfTextPenalty;
    }
    deltas.push({ reason: "wall_of_text", amount: -round1(amount) });
  }

  if (input.isFirstTouch && analysis.pitchDetected) {
    deltas.push({
      reason: "pitch_first_touch",
      amount: -config.pitchFirstTouchPenalty,
    });
  }

  const ctaCount = written?.ctaCount ?? 0;
  if (metrics.questionCount === 0 && ctaCount === 0) {
    deltas.push({ reason: "no_question", amount: -config.noQuestionPenalty });
  }
  if (metrics.questionCount >= 3) {
    deltas.push({
      reason: "stacked_questions",
      amount: -config.stackedQuestionPenalty,
    });
  }
  if (ctaCount >= 2) {
    deltas.push({ reason: "multi_cta", amount: -config.multiCtaPenalty });
  }

  // Spam signals: subject-line hits count double (email filters weight
  // subjects 2–3x — email-channel.md §B5).
  const spamHits =
    metrics.spamTriggerHits.length +
    2 * (metrics.subject?.spamTriggerHits.length ?? 0);
  if (spamHits > 0) {
    deltas.push({
      reason: "spam_signals",
      amount: -round1(spamHits * config.spamSignalPenalty),
    });
  }

  if (metrics.selfFocusRatio > 0.6) {
    deltas.push({ reason: "self_focused", amount: -config.selfFocusPenalty });
  }

  if (analysis.pressure > 0.5) {
    deltas.push({
      reason: "pressure",
      amount: -round1((analysis.pressure - 0.5) * 2 * config.pressurePenaltyScale),
    });
  }

  if (metrics.guiltTripHits.length > 0) {
    deltas.push({ reason: "guilt_trip", amount: -config.guiltTripPenalty });
  }

  // Cadence: following up into silence too soon, or with nothing new.
  const waitedEnough =
    input.minutesSinceLastRepMessage === null ||
    input.minutesSinceLastRepMessage >= config.minFollowUpGapMinutes;
  if (input.isFollowUpIntoSilence) {
    if (!waitedEnough) {
      deltas.push({
        reason: "too_soon_follow_up",
        amount: -config.tooSoonFollowUpPenalty,
      });
    }
    if (written && !written.addsNewValue) {
      deltas.push({ reason: "no_new_value", amount: -config.noNewValuePenalty });
    }
  }

  // Regen candidates, capped per turn like the call engine.
  const regenCandidates: PatienceDelta[] = [];
  if (written && written.relevance >= 0.6) {
    regenCandidates.push({
      reason: "relevant_personalization",
      amount: config.relevanceRegen,
    });
  }
  if (analysis.reflectionTargets.some((t) => t.accuracy >= 0.6)) {
    regenCandidates.push({
      reason: "accurate_reflection",
      amount: config.reflectionRegen,
    });
  }
  if (ctaCount === 1 && metrics.questionCount <= 2) {
    regenCandidates.push({ reason: "clear_cta", amount: config.clearCtaRegen });
  }
  if (
    input.isFollowUpIntoSilence &&
    waitedEnough &&
    input.minutesSinceLastRepMessage !== null &&
    written?.addsNewValue
  ) {
    regenCandidates.push({
      reason: "patient_follow_up",
      amount: config.patientFollowUpRegen,
    });
  }
  const regenTotal = regenCandidates.reduce((acc, d) => acc + d.amount, 0);
  const scale =
    regenTotal > config.maxRegenPerTurn ? config.maxRegenPerTurn / regenTotal : 1;
  for (const candidate of regenCandidates) {
    deltas.push({ ...candidate, amount: round1(candidate.amount * scale) });
  }

  const value = clamp(
    round1(deltas.reduce((acc, d) => acc + d.amount, current)),
  );

  // Terminal states. An explicit opt-out (STOP / unsubscribe / block) fires
  // when the rep pushes — pressure or heavy spam — into an already-cold
  // prospect (sms-channel.md §A12, email-channel.md §B5). Plain zero is a
  // ghost: the thread just dies.
  let terminal: EngagementTurnResult["terminal"] = "none";
  if (
    value < config.optOutBelowEngagement &&
    (analysis.pressure > 0.5 || spamHits >= 3)
  ) {
    terminal = "opted_out";
  } else if (value <= MIN) {
    terminal = "ghosted";
  }

  return { value, deltas, terminal };
}

/**
 * Deterministic reply-or-silence decision. The realistic outcome of a bad
 * message on an async channel is silence, not an annoyed reply
 * (email-channel.md §A1: only ~3.4% of cold emails get any reply at all).
 * Silence past the ghost threshold ends the thread for good.
 */
export function decideReply(
  engagement: number,
  unansweredStreak: number,
  config: EngagementConfig,
): ReplyDecision & { terminal: "none" | "ghosted" } {
  if (engagement >= config.replyThreshold) {
    return {
      replies: true,
      delayMinutes: replyDelayMinutes(engagement, config),
      terminal: "none",
    };
  }
  return {
    replies: false,
    delayMinutes: 0,
    terminal:
      unansweredStreak >= config.ghostAfterUnanswered ? "ghosted" : "none",
  };
}

/** Simulated reply latency band from engagement. */
export function replyDelayMinutes(
  engagement: number,
  config: EngagementConfig,
): number {
  if (engagement >= 75) return config.replyDelayMinutes.fast;
  if (engagement >= 55) return config.replyDelayMinutes.medium;
  return config.replyDelayMinutes.slow;
}

/** Async channels reuse the patience bands to shape prospect tone. */
export function engagementBand(engagement: number): PatienceBand {
  return patienceBand(engagement);
}
