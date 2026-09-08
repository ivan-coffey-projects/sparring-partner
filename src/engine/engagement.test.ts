import { describe, expect, it } from "vitest";
import {
  applyEngagementTurn,
  decideReply,
  replyDelayMinutes,
  type EngagementTurnInput,
} from "@/engine/engagement";
import { engagementConfigFor } from "@/engine/channels";
import { computeWrittenMetrics } from "@/engine/written-metrics";
import type { MoveAnalysis, WrittenAnalysis } from "@/engine/types";

const SMS = engagementConfigFor("sms");
const EMAIL = engagementConfigFor("email");
const LINKEDIN = engagementConfigFor("dm_linkedin");

function analysis(overrides: Partial<MoveAnalysis> = {}): MoveAnalysis {
  return {
    moveTypes: ["other"],
    reflectionTargets: [],
    pitchDetected: false,
    pressure: 0.1,
    ...overrides,
  };
}

function written(overrides: Partial<WrittenAnalysis> = {}): WrittenAnalysis {
  return {
    relevance: 0.3,
    addsNewValue: true,
    ctaCount: 1,
    ctaType: "question",
    ...overrides,
  };
}

function input(
  text: string,
  overrides: Partial<EngagementTurnInput> = {},
): EngagementTurnInput {
  return {
    analysis: analysis({ written: written() }),
    metrics: computeWrittenMetrics(text),
    isFirstTouch: false,
    isFollowUpIntoSilence: false,
    minutesSinceLastRepMessage: null,
    ...overrides,
  };
}

const SHORT_GOOD = "Saw dispatch is re-planning at 5am — is that still you? Worth a quick look?";

describe("applyEngagementTurn", () => {
  it("penalizes a wall of text on SMS but not on email", () => {
    const wall = "word ".repeat(80); // ~400 chars
    const sms = applyEngagementTurn(60, input(wall), SMS);
    expect(sms.deltas.some((d) => d.reason === "wall_of_text")).toBe(true);
    const email = applyEngagementTurn(60, input(wall), EMAIL);
    expect(email.deltas.some((d) => d.reason === "wall_of_text")).toBe(false);
  });

  it("applies the strongest first-touch pitch penalty on LinkedIn", () => {
    const opener = input(SHORT_GOOD, {
      isFirstTouch: true,
      analysis: analysis({ pitchDetected: true, written: written() }),
    });
    const li = applyEngagementTurn(60, opener, LINKEDIN);
    const sms = applyEngagementTurn(60, opener, SMS);
    const liPitch = li.deltas.find((d) => d.reason === "pitch_first_touch");
    const smsPitch = sms.deltas.find((d) => d.reason === "pitch_first_touch");
    expect(liPitch).toBeDefined();
    expect(smsPitch).toBeDefined();
    expect(Math.abs(liPitch!.amount)).toBeGreaterThan(Math.abs(smsPitch!.amount));
  });

  it("penalizes a message with no question and no ask", () => {
    const result = applyEngagementTurn(
      60,
      input("We are the market leader in routing software.", {
        analysis: analysis({ written: written({ ctaCount: 0, ctaType: "none" }) }),
      }),
      SMS,
    );
    expect(result.deltas.some((d) => d.reason === "no_question")).toBe(true);
  });

  it("penalizes multiple CTAs and rewards exactly one clear ask", () => {
    const multi = applyEngagementTurn(
      60,
      input(SHORT_GOOD, {
        analysis: analysis({ written: written({ ctaCount: 3 }) }),
      }),
      EMAIL,
    );
    expect(multi.deltas.some((d) => d.reason === "multi_cta")).toBe(true);
    const single = applyEngagementTurn(60, input(SHORT_GOOD), EMAIL);
    expect(single.deltas.some((d) => d.reason === "clear_cta")).toBe(true);
  });

  it("doubles subject-line spam hits on email", () => {
    const bodyOnly = applyEngagementTurn(
      60,
      input("This free tool saves money. Worth a look?"),
      EMAIL,
    );
    const inSubject = applyEngagementTurn(60, {
      ...input("A tool that saves money. Worth a look?"),
      metrics: computeWrittenMetrics(
        "A tool that saves money. Worth a look?",
        "free guarantee",
      ),
    }, EMAIL);
    const bodyDelta = bodyOnly.deltas.find((d) => d.reason === "spam_signals");
    const subjDelta = inSubject.deltas.find((d) => d.reason === "spam_signals");
    expect(bodyDelta).toBeDefined();
    expect(subjDelta).toBeDefined();
    expect(Math.abs(subjDelta!.amount)).toBeGreaterThan(Math.abs(bodyDelta!.amount));
  });

  it("penalizes guilt-trip bumps and too-soon follow-ups into silence", () => {
    const result = applyEngagementTurn(
      60,
      input("Just following up on my last message — any thoughts?", {
        isFollowUpIntoSilence: true,
        minutesSinceLastRepMessage: 60,
        analysis: analysis({ written: written({ addsNewValue: false, ctaCount: 0 }) }),
      }),
      SMS,
    );
    const reasons = result.deltas.map((d) => d.reason);
    expect(reasons).toContain("guilt_trip");
    expect(reasons).toContain("too_soon_follow_up");
    expect(reasons).toContain("no_new_value");
  });

  it("rewards a patient, value-adding follow-up", () => {
    const result = applyEngagementTurn(
      50,
      input("Saw the Q3 filing mentions routing costs — that changes what I sent. Worth a look?", {
        isFollowUpIntoSilence: true,
        minutesSinceLastRepMessage: SMS.minFollowUpGapMinutes + 60,
        analysis: analysis({ written: written({ relevance: 0.8 }) }),
      }),
      SMS,
    );
    const reasons = result.deltas.map((d) => d.reason);
    expect(reasons).toContain("patient_follow_up");
    expect(reasons).toContain("relevant_personalization");
    expect(result.value).toBeGreaterThan(50);
  });

  it("caps regen per turn", () => {
    const result = applyEngagementTurn(
      50,
      input(SHORT_GOOD, {
        isFollowUpIntoSilence: true,
        minutesSinceLastRepMessage: SMS.minFollowUpGapMinutes + 60,
        analysis: analysis({
          written: written({ relevance: 0.9 }),
          reflectionTargets: [{ topic: "budget", accuracy: 0.9 }],
        }),
      }),
      SMS,
    );
    const regen = result.deltas
      .filter((d) => d.amount > 0)
      .reduce((acc, d) => acc + d.amount, 0);
    expect(regen).toBeLessThanOrEqual(SMS.maxRegenPerTurn + 0.001);
  });

  it("fires opted_out when the rep pushes into an already-cold prospect", () => {
    const result = applyEngagementTurn(
      24,
      input("Last chance — I need an answer today. Sign now!", {
        analysis: analysis({ pressure: 0.9, written: written({ ctaCount: 1 }) }),
      }),
      SMS,
    );
    expect(result.terminal).toBe("opted_out");
  });

  it("fires ghosted at zero without a push", () => {
    const wall = "word ".repeat(160);
    const result = applyEngagementTurn(
      4,
      input(wall, {
        analysis: analysis({ written: written({ ctaCount: 0 }) }),
      }),
      SMS,
    );
    expect(result.value).toBe(0);
    expect(result.terminal).toBe("ghosted");
  });
});

describe("decideReply", () => {
  it("replies at or above the threshold, with delay shrinking as engagement rises", () => {
    const warm = decideReply(80, 0, SMS);
    const cool = decideReply(SMS.replyThreshold, 0, SMS);
    expect(warm.replies).toBe(true);
    expect(cool.replies).toBe(true);
    expect(warm.delayMinutes).toBeLessThan(cool.delayMinutes);
  });

  it("stays silent below the threshold and ghosts past the streak limit", () => {
    const silent = decideReply(SMS.replyThreshold - 1, 1, SMS);
    expect(silent.replies).toBe(false);
    expect(silent.terminal).toBe("none");
    const ghosted = decideReply(30, SMS.ghostAfterUnanswered, SMS);
    expect(ghosted.terminal).toBe("ghosted");
  });

  it("LinkedIn replies are never minutes-fast", () => {
    expect(replyDelayMinutes(90, LINKEDIN)).toBeGreaterThanOrEqual(240);
  });
});
