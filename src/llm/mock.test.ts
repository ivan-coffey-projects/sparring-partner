import { describe, expect, it } from "vitest";
import { firstPersonize } from "@/llm/mock";

describe("firstPersonize", () => {
  it("converts trainer-voice truths into the prospect's own voice", () => {
    expect(
      firstPersonize(
        "She quotes a lower number to vendors. Dana can only approve $15k herself, and she got burned bringing Marcus a half-baked proposal — she won't do that again.",
        "Dana Whitfield",
      ),
    ).toBe(
      "I quote a lower number to vendors. I can only approve $15k myself, and I got burned bringing Marcus a half-baked proposal — I won't do that again.",
    );
  });

  it("handles possessives and contractions", () => {
    expect(
      firstPersonize(
        "They renewed it on Dana's recommendation. She's embarrassed about it, and her best ops lead quit.",
        "Dana Whitfield",
      ),
    ).toBe(
      "They renewed it on my recommendation. I'm embarrassed about it, and my best ops lead quit.",
    );
  });

  it("fixes irregular verbs and leaves third parties alone", () => {
    expect(
      firstPersonize(
        "CFO Marcus Yuen signs anything over $50k. She has no signing power and she is aware of it.",
        "Dana Whitfield",
      ),
    ).toBe(
      "CFO Marcus Yuen signs anything over $50k. I have no signing power and I am aware of it.",
    );
  });

  it("leaves already-neutral text untouched", () => {
    const neutral =
      "Peak-season contract negotiations start in ten weeks; unfixed routing means eating another year.";
    expect(firstPersonize(neutral, "Dana Whitfield")).toBe(neutral);
  });
});
