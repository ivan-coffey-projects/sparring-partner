import type {
  HiddenFactDefinition,
  MoveAnalysis,
  UnlockRule,
  UnlockState,
  UnlockTurnResult,
} from "@/engine/types";

/**
 * Trust accrues from moves that demonstrate understanding. Pure arithmetic —
 * the analyzer classifies, code decides how much trust that's worth.
 */
export function trustGained(analysis: MoveAnalysis): number {
  let gained = 0;
  for (const target of analysis.reflectionTargets) {
    if (target.accuracy >= 0.6) {
      gained += round1(target.accuracy * 8);
    }
  }
  if (analysis.moveTypes.includes("open_question")) {
    gained += 2;
  }
  if (analysis.moveTypes.includes("rapport")) {
    gained += 1;
  }
  // Pushy moves spend trust.
  if (analysis.moveTypes.includes("blunt_qualifying")) {
    gained -= 3;
  }
  if (analysis.pressure > 0.5) {
    gained -= round1((analysis.pressure - 0.5) * 2 * 4);
  }
  return round1(gained);
}

/** Accuracy at which a reflection counts as landed — matches `trustGained`. */
const REFLECTION_ACCURACY_FLOOR = 0.6;

/** Accurate reflections in this turn's analysis. */
function reflectionsIn(analysis: MoveAnalysis): number {
  return analysis.reflectionTargets.filter(
    (t) => t.accuracy >= REFLECTION_ACCURACY_FLOOR,
  ).length;
}

function ruleSatisfied(
  rule: UnlockRule,
  analysis: MoveAnalysis,
  trust: number,
  reflectionsEarned: number,
): boolean {
  switch (rule.type) {
    case "reflection":
      return analysis.reflectionTargets.some(
        (t) => t.topic === rule.topic && t.accuracy >= rule.minAccuracy,
      );
    case "trust":
      // Trust accrues a little from any question, so a long run of pushy or
      // manipulative probes will drift across a bare `minTrust` threshold
      // without the rep ever demonstrating understanding. Requiring a landed
      // reflection closes that path in code rather than relying on the
      // analyzer to score manipulation as pressure.
      return reflectionsEarned >= 1 && trust >= rule.minTrust;
    default: {
      const exhaustive: never = rule;
      throw new Error(`Unhandled unlock rule: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Evaluates every still-locked fact against this turn's analysis and the
 * post-turn trust score. Returns the next unlock state plus what just opened.
 */
export function applyUnlockTurn(
  state: UnlockState,
  facts: HiddenFactDefinition[],
  analysis: MoveAnalysis,
): UnlockTurnResult {
  const trust = round1(state.trust + trustGained(analysis));
  const reflectionsEarned = state.reflectionsEarned + reflectionsIn(analysis);
  const unlocked = new Set(state.unlockedFactIds);
  const newlyUnlockedFactIds: string[] = [];

  for (const fact of facts) {
    if (unlocked.has(fact.id)) continue;
    if (ruleSatisfied(fact.rule, analysis, trust, reflectionsEarned)) {
      unlocked.add(fact.id);
      newlyUnlockedFactIds.push(fact.id);
    }
  }

  return {
    state: { unlockedFactIds: [...unlocked], trust, reflectionsEarned },
    newlyUnlockedFactIds,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
