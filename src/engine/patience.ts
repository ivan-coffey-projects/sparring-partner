import type {
  MoveAnalysis,
  PatienceBand,
  PatienceConfig,
  PatienceDelta,
  PatienceTurnResult,
  TurnMetrics,
} from "@/engine/types";

const PATIENCE_MIN = 0;
const PATIENCE_MAX = 100;

function clamp(value: number): number {
  return Math.min(PATIENCE_MAX, Math.max(PATIENCE_MIN, value));
}

/**
 * The patience state machine. Pure: patience in, analysis + code metrics in,
 * patience out. The prospect model never decides how patient it feels.
 *
 * Penalties (negative deltas):
 *  - monologue: per word over the configured threshold (metrics are code-computed)
 *  - early pitch: pitching before `discoveryGate` hidden facts are unlocked
 *  - blunt qualifying question: cold budget/authority/timeline interrogation
 *  - stacked questions: 3+ questions in one turn
 *  - pressure: scaled by the analyzer's 0..1 pressure read
 *
 * Regen (positive deltas, capped per turn):
 *  - accurate reflection (any reflection target with accuracy ≥ 0.6)
 *  - open question
 */
export function applyPatienceTurn(
  current: number,
  analysis: MoveAnalysis,
  metrics: TurnMetrics,
  factsUnlockedCount: number,
  config: PatienceConfig,
): PatienceTurnResult {
  const deltas: PatienceDelta[] = [];

  if (metrics.wordCount > config.monologueWordThreshold) {
    const over = metrics.wordCount - config.monologueWordThreshold;
    deltas.push({
      reason: "monologue",
      amount: -round1(over * config.monologuePenaltyPerWord),
    });
  }

  if (analysis.pitchDetected && factsUnlockedCount < config.discoveryGate) {
    deltas.push({ reason: "early_pitch", amount: -config.earlyPitchPenalty });
  }

  if (analysis.moveTypes.includes("blunt_qualifying")) {
    deltas.push({
      reason: "blunt_question",
      amount: -config.bluntQuestionPenalty,
    });
  }

  if (metrics.questionCount >= 3) {
    deltas.push({
      reason: "stacked_questions",
      amount: -config.stackedQuestionPenalty,
    });
  }

  if (analysis.pressure > 0.5) {
    deltas.push({
      reason: "pressure",
      amount: -round1((analysis.pressure - 0.5) * 2 * config.pressurePenaltyScale),
    });
  }

  let regen = 0;
  const accurateReflection = analysis.reflectionTargets.some(
    (t) => t.accuracy >= 0.6,
  );
  if (accurateReflection) {
    regen += config.reflectionRegen;
  }
  if (analysis.moveTypes.includes("open_question")) {
    regen += config.openQuestionRegen;
  }
  regen = Math.min(regen, config.maxRegenPerTurn);
  if (regen > 0) {
    if (accurateReflection) {
      const reflectionShare = Math.min(regen, config.reflectionRegen);
      deltas.push({ reason: "accurate_reflection", amount: reflectionShare });
      regen -= reflectionShare;
    }
    if (regen > 0) {
      deltas.push({ reason: "open_question", amount: regen });
    }
  }

  const value = clamp(
    round1(deltas.reduce((acc, d) => acc + d.amount, current)),
  );
  return { value, deltas, hangUp: value <= PATIENCE_MIN };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Maps a numeric patience to the tone band fed to the prospect model. */
export function patienceBand(patience: number): PatienceBand {
  if (patience <= 0) return "done";
  if (patience < 25) return "impatient";
  if (patience < 55) return "cooling";
  return "engaged";
}
