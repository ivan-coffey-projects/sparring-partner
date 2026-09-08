import { afterEach, describe, expect, it, vi } from "vitest";
import { isGradingStale } from "@/lib/freshness";

const NOW = new Date("2026-08-25T00:00:00Z");

describe("isGradingStale", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the current grading attempt instead of the report creation time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(
      isGradingStale({
        status: "grading",
        createdAt: NOW.getTime() - 60 * 60 * 1000,
        gradingStartedAt: NOW.getTime() - 30 * 1000,
        gradedAt: null,
      }),
    ).toBe(false);
  });

  it("marks a grading attempt stale after three minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(
      isGradingStale({
        status: "grading",
        createdAt: NOW.getTime() - 60 * 60 * 1000,
        gradingStartedAt: NOW.getTime() - 3 * 60 * 1000 - 1,
        gradedAt: null,
      }),
    ).toBe(true);
  });
});
