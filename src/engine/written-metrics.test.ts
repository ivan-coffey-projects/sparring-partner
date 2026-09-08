import { describe, expect, it } from "vitest";
import {
  computeWrittenMetrics,
  findGuiltTripPhrases,
  fleschKincaidGrade,
  selfFocusRatio,
} from "@/engine/written-metrics";

describe("computeWrittenMetrics", () => {
  it("counts chars, links, emoji, exclamations, and caps", () => {
    const m = computeWrittenMetrics(
      "AMAZING deal!! Check https://example.com and www.foo.io 🚀🔥",
    );
    expect(m.charCount).toBeGreaterThan(40);
    expect(m.linkCount).toBe(2);
    expect(m.emojiCount).toBe(2);
    expect(m.exclamationCount).toBe(2);
    expect(m.allCapsWords).toBe(1);
  });

  it("does not count common business acronyms as shouting", () => {
    const m = computeWrittenMetrics("Our CEO asked about ROI on the API.");
    expect(m.allCapsWords).toBe(0);
  });

  it("finds spam triggers as whole phrases only", () => {
    const m = computeWrittenMetrics(
      "Act now — this is a limited time offer, 100% free!",
    );
    expect(m.spamTriggerHits).toContain("act now");
    expect(m.spamTriggerHits).toContain("limited time");
    expect(m.spamTriggerHits).toContain("free");
    // "freedom" must not match "free"
    const clean = computeWrittenMetrics("We value freedom and guarantees of privacy.");
    expect(clean.spamTriggerHits).not.toContain("free");
  });

  it("computes subject metrics when a subject is provided", () => {
    const m = computeWrittenMetrics("Body text here.", "quick question?");
    expect(m.subject).toBeDefined();
    expect(m.subject?.wordCount).toBe(2);
    expect(m.subject?.isQuestion).toBe(true);
  });

  it("leaves subject undefined for subject-less channels", () => {
    expect(computeWrittenMetrics("hey, quick one").subject).toBeUndefined();
  });
});

describe("findGuiltTripPhrases", () => {
  it("catches the measured reply-killers", () => {
    expect(findGuiltTripPhrases("Just following up on this")).toContain(
      "just following up",
    );
    expect(findGuiltTripPhrases("I never heard back from you")).toContain(
      "never heard back",
    );
    expect(findGuiltTripPhrases("Any thoughts?")).toContain("any thoughts");
    expect(findGuiltTripPhrases("Just bumping this to the top")).toContain(
      "bumping this",
    );
  });

  it("does not flag a value-adding follow-up", () => {
    expect(
      findGuiltTripPhrases(
        "Saw the Q3 filing mentioned routing costs — that changes the math I sent.",
      ),
    ).toHaveLength(0);
  });
});

describe("fleschKincaidGrade", () => {
  it("scores simple prose low and dense prose high", () => {
    const simple = fleschKincaidGrade("We help ops teams. Loads get lost. We stop that.");
    const dense = fleschKincaidGrade(
      "Our organization facilitates comprehensive operational optimization methodologies leveraging sophisticated algorithmic infrastructure capabilities.",
    );
    expect(simple).toBeLessThan(6);
    expect(dense).toBeGreaterThan(12);
  });

  it("returns 0 for empty text", () => {
    expect(fleschKincaidGrade("")).toBe(0);
  });
});

describe("selfFocusRatio", () => {
  it("is high for sender-focused text and low for prospect-focused text", () => {
    expect(
      selfFocusRatio("I wanted to tell you about our company. We built our platform and we love it."),
    ).toBeGreaterThan(0.6);
    expect(
      selfFocusRatio("Your team handles routing. You mentioned your peak season is brutal."),
    ).toBeLessThan(0.3);
  });

  it("defaults to 0.5 when neither appears", () => {
    expect(selfFocusRatio("The weather is nice.")).toBe(0.5);
  });
});
