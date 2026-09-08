import { describe, expect, it } from "vitest";
import { computeTurnMetrics } from "@/engine/metrics";

describe("computeTurnMetrics", () => {
  it("counts words and question marks", () => {
    expect(computeTurnMetrics("How does dispatch work today?")).toEqual({
      wordCount: 5,
      questionCount: 1,
    });
  });

  it("handles empty and whitespace-only input", () => {
    expect(computeTurnMetrics("")).toEqual({ wordCount: 0, questionCount: 0 });
    expect(computeTurnMetrics("   \n ")).toEqual({
      wordCount: 0,
      questionCount: 0,
    });
  });

  it("counts stacked questions", () => {
    expect(
      computeTurnMetrics("What's your budget? Who signs? When do you decide?"),
    ).toEqual({ wordCount: 9, questionCount: 3 });
  });
});
