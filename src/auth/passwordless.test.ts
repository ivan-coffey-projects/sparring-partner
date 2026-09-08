import { describe, expect, it } from "vitest";
import { isPasswordlessLoginEnabled } from "@/auth/passwordless";

describe("passwordless login", () => {
  it("requires an explicit local opt-in", () => {
    expect(isPasswordlessLoginEnabled({})).toBe(false);
    expect(isPasswordlessLoginEnabled({ SP_PASSWORDLESS_LOGIN: "0" })).toBe(false);
    expect(isPasswordlessLoginEnabled({ SP_PASSWORDLESS_LOGIN: "1" })).toBe(true);
  });
});
