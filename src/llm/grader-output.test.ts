import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import { generateGraderOutput } from "@/llm/grader-output";
import { defineMockModel } from "@/llm/mock";
import type { GraderOutput } from "@/llm/schemas";

const VALID_OUTPUT: GraderOutput = {
  criteria: [
    {
      criterionId: "criterion-1",
      score: 4,
      rationale: "The rep asked a focused question.",
      citation: {
        methodologyEntryNumber: "1.1",
        transcriptQuote: "What changed?",
        turnIdx: 1,
      },
    },
  ],
  coachingPoints: [],
};

describe("generateGraderOutput", () => {
  it("requests JSON output and returns the locally validated object", async () => {
    let responseFormat: LanguageModelV4CallOptions["responseFormat"];
    let maxOutputTokens: LanguageModelV4CallOptions["maxOutputTokens"];
    const model = defineMockModel("structured-grader", (options) => {
      responseFormat = options.responseFormat;
      maxOutputTokens = options.maxOutputTokens;
      return { text: JSON.stringify(VALID_OUTPUT) };
    });

    await expect(
      generateGraderOutput(model, "Grade this call.", "Transcript"),
    ).resolves.toEqual(VALID_OUTPUT);
    if (responseFormat?.type !== "json") {
      throw new Error("Expected JSON response format.");
    }
    expect(responseFormat?.schema).toBeUndefined();
    expect(maxOutputTokens).toBe(8192);
  });

  it("rejects output that does not satisfy the grader schema", async () => {
    const model = defineMockModel("invalid-grader", () => ({
      text: JSON.stringify({ criteria: [], coachingPoints: [{ severity: "fine" }] }),
    }));

    await expect(
      generateGraderOutput(model, "Grade this call.", "Transcript"),
    ).rejects.toThrow();
  });
});
