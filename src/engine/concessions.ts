import type {
  ConcessionCaps,
  ConcessionContext,
  ConcessionRequest,
  ConcessionVerdict,
} from "@/engine/types";

/**
 * The hard cap. The prospect model can *request* a concession (via its
 * `concede` tool); only this function can grant one. No prompt can widen
 * these limits.
 */
export function validateConcession(
  caps: ConcessionCaps,
  context: ConcessionContext,
  request: ConcessionRequest,
): ConcessionVerdict {
  if (context.approvedConcessionCount >= caps.maxConcessionsTotal) {
    return {
      approved: false,
      reason: `Already made ${context.approvedConcessionCount} commitments this call — that's the ceiling.`,
    };
  }

  switch (request.type) {
    case "meeting": {
      if (context.factsUnlockedCount < caps.meetingRequiresFactsUnlocked) {
        return {
          approved: false,
          reason: `A meeting requires ${caps.meetingRequiresFactsUnlocked} uncovered facts; only ${context.factsUnlockedCount} so far.`,
        };
      }
      if (context.patience < caps.meetingRequiresPatienceAtLeast) {
        return {
          approved: false,
          reason: `Patience is at ${context.patience}; a meeting requires at least ${caps.meetingRequiresPatienceAtLeast}.`,
        };
      }
      return { approved: true };
    }
    case "intro": {
      if (!caps.allowIntro) {
        return {
          approved: false,
          reason: "This prospect will never agree to an intro on this call.",
        };
      }
      if (context.factsUnlockedCount < caps.introRequiresFactsUnlocked) {
        return {
          approved: false,
          reason: `An intro requires ${caps.introRequiresFactsUnlocked} uncovered facts; only ${context.factsUnlockedCount} so far.`,
        };
      }
      return { approved: true };
    }
    case "pilot": {
      if (!caps.allowPilot) {
        return {
          approved: false,
          reason: "This prospect will never agree to a pilot on this call.",
        };
      }
      if (context.factsUnlockedCount < caps.pilotRequiresFactsUnlocked) {
        return {
          approved: false,
          reason: `A pilot requires ${caps.pilotRequiresFactsUnlocked} uncovered facts; only ${context.factsUnlockedCount} so far.`,
        };
      }
      const budget = request.value ?? 0;
      if (budget > caps.maxPilotBudget) {
        return {
          approved: false,
          reason: `Pilot budget is hard-capped at $${caps.maxPilotBudget}; $${budget} was requested.`,
        };
      }
      return { approved: true };
    }
    case "timeline_change": {
      if (!caps.allowTimelineChange) {
        return {
          approved: false,
          reason:
            "This prospect will never agree to change their timeline on this call.",
        };
      }
      return { approved: true };
    }
    default: {
      const exhaustive: never = request.type;
      throw new Error(`Unhandled concession type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Belt-and-suspenders: scan generated prospect text for commitment language
 * that should only ever be expressed through an approved `concede` tool call.
 * Used to detect (and reject) a reply where the model "agreed" in prose.
 */
const COMMITMENT_PATTERNS: RegExp[] = [
  /\b(let'?s|we can|i can|i'?ll|happy to)\s+(book|schedule|set up|put)\s+(a|the|some)?\s*(meeting|call|demo|time)\b/i,
  /\bsend (me|over) (a|the) (calendar|invite)\b/i,
  /\bi'?ll (introduce|connect|loop in|bring in)\b/i,
  /\bi can get you (in front of|time with)\b/i,
  /\b(we|i)('?ll| will| can) (do|start|run|fund) (a|the) (pilot|trial|proof of concept|poc)\b/i,
  /\byou'?ve got (a deal|yourself a deal)\b/i,
  /\bsign (me|us) up\b/i,
];

export function detectUnauthorizedCommitment(text: string): boolean {
  return COMMITMENT_PATTERNS.some((pattern) => pattern.test(text));
}
