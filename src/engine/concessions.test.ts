import { describe, expect, it } from "vitest";
import {
  detectUnauthorizedCommitment,
  validateConcession,
} from "@/engine/concessions";
import type { ConcessionCaps, ConcessionContext } from "@/engine/types";

const caps: ConcessionCaps = {
  meetingRequiresFactsUnlocked: 2,
  meetingRequiresPatienceAtLeast: 40,
  allowIntro: true,
  introRequiresFactsUnlocked: 3,
  allowPilot: true,
  maxPilotBudget: 10000,
  pilotRequiresFactsUnlocked: 4,
  allowTimelineChange: false,
  maxConcessionsTotal: 2,
};

function ctx(overrides: Partial<ConcessionContext> = {}): ConcessionContext {
  return {
    patience: 60,
    factsUnlockedCount: 3,
    approvedConcessionCount: 0,
    ...overrides,
  };
}

describe("validateConcession", () => {
  it("approves a meeting when facts and patience clear the bar", () => {
    expect(validateConcession(caps, ctx(), { type: "meeting" })).toEqual({
      approved: true,
    });
  });

  it("rejects a meeting with too few facts uncovered", () => {
    const verdict = validateConcession(caps, ctx({ factsUnlockedCount: 1 }), {
      type: "meeting",
    });
    expect(verdict.approved).toBe(false);
  });

  it("rejects a meeting when patience is too low", () => {
    const verdict = validateConcession(caps, ctx({ patience: 39 }), {
      type: "meeting",
    });
    expect(verdict.approved).toBe(false);
  });

  it("rejects intros when disabled, regardless of anything else", () => {
    const noIntro: ConcessionCaps = { ...caps, allowIntro: false };
    const verdict = validateConcession(
      noIntro,
      ctx({ factsUnlockedCount: 5, patience: 100 }),
      { type: "intro" },
    );
    expect(verdict.approved).toBe(false);
  });

  it("gates intros on uncovered facts", () => {
    expect(
      validateConcession(caps, ctx({ factsUnlockedCount: 2 }), {
        type: "intro",
      }).approved,
    ).toBe(false);
    expect(
      validateConcession(caps, ctx({ factsUnlockedCount: 3 }), {
        type: "intro",
      }).approved,
    ).toBe(true);
  });

  it("hard-caps pilot budgets in code", () => {
    const context = ctx({ factsUnlockedCount: 5 });
    expect(
      validateConcession(caps, context, { type: "pilot", value: 10000 })
        .approved,
    ).toBe(true);
    expect(
      validateConcession(caps, context, { type: "pilot", value: 10001 })
        .approved,
    ).toBe(false);
  });

  it("rejects pilots when disabled even with a zero budget", () => {
    const noPilot: ConcessionCaps = { ...caps, allowPilot: false };
    expect(
      validateConcession(noPilot, ctx({ factsUnlockedCount: 5 }), {
        type: "pilot",
        value: 0,
      }).approved,
    ).toBe(false);
  });

  it("rejects timeline changes when disabled", () => {
    expect(
      validateConcession(caps, ctx(), { type: "timeline_change" }).approved,
    ).toBe(false);
  });

  it("enforces the total-concessions ceiling before anything else", () => {
    const verdict = validateConcession(
      caps,
      ctx({ approvedConcessionCount: 2, factsUnlockedCount: 5, patience: 100 }),
      { type: "meeting" },
    );
    expect(verdict.approved).toBe(false);
  });
});

describe("detectUnauthorizedCommitment", () => {
  it("flags prose that books a meeting", () => {
    expect(
      detectUnauthorizedCommitment(
        "Sure — let's schedule a meeting for Thursday.",
      ),
    ).toBe(true);
    expect(
      detectUnauthorizedCommitment("I'll set up a call with my team."),
    ).toBe(true);
  });

  it("flags prose that promises an intro or a pilot", () => {
    expect(
      detectUnauthorizedCommitment("I'll introduce you to our CFO."),
    ).toBe(true);
    expect(
      detectUnauthorizedCommitment("We can run a pilot next month."),
    ).toBe(true);
  });

  it("does not flag ordinary conversation", () => {
    expect(
      detectUnauthorizedCommitment(
        "We renewed our current system last year, so timing is tricky.",
      ),
    ).toBe(false);
    expect(
      detectUnauthorizedCommitment(
        "What would that mean for our dispatch team?",
      ),
    ).toBe(false);
  });

  it("does not flag a refusal that mentions meetings", () => {
    expect(
      detectUnauthorizedCommitment(
        "A meeting feels premature — I'm not ready to commit to anything.",
      ),
    ).toBe(false);
  });
});
