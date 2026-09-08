import { describe, expect, it } from "vitest";
import { gateCoachingPoints, quoteAppearsIn } from "@/engine/citations";
import type {
  MethodologyEntryRef,
  RawCoachingPoint,
  TranscriptTurnRef,
} from "@/engine/types";

const entries: MethodologyEntryRef[] = [
  {
    id: "e-31",
    number: "3.1",
    title: "No pitch before pain",
    text: "Hold the pitch until pain is on the table.",
  },
  {
    id: "e-21",
    number: "2.1",
    title: "Reflect before you redirect",
    text: "Restate their situation before steering.",
  },
];

const turns: TranscriptTurnRef[] = [
  {
    idx: 0,
    speaker: "rep",
    text: "Thanks for taking the time, Dana. Before anything else — can you walk me through how dispatch handles a multi-stop load today?",
  },
  {
    idx: 1,
    speaker: "prospect",
    text: "Our current system does the job, more or less.",
  },
  {
    idx: 2,
    speaker: "rep",
    text: "Let me show you our routing engine — it's the fastest on the market, hands down, and our customers love it.",
  },
];

function point(overrides: Partial<RawCoachingPoint>): RawCoachingPoint {
  return {
    methodologyEntryNumber: "3.1",
    transcriptQuote: "Let me show you our routing engine",
    turnIdx: 2,
    comment: "Pitched before any pain was voiced.",
    severity: "major",
    ...overrides,
  };
}

describe("gateCoachingPoints", () => {
  it("keeps a point with a real entry and a verbatim quote", () => {
    const result = gateCoachingPoints([point({})], entries, turns);
    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(0);
    expect(result.kept[0].methodologyEntryId).toBe("e-31");
    expect(result.kept[0].methodologyEntryTitle).toBe("No pitch before pain");
  });

  it("drops a point citing a nonexistent methodology entry", () => {
    const result = gateCoachingPoints(
      [point({ methodologyEntryNumber: "9.9" })],
      entries,
      turns,
    );
    expect(result.kept).toHaveLength(0);
    expect(result.dropped).toEqual([
      { point: point({ methodologyEntryNumber: "9.9" }), reason: "unknown_entry" },
    ]);
  });

  it("drops a point referencing a turn that does not exist", () => {
    const result = gateCoachingPoints([point({ turnIdx: 99 })], entries, turns);
    expect(result.dropped[0]?.reason).toBe("bad_turn_ref");
  });

  it("drops a point whose quote is not in the cited turn", () => {
    const result = gateCoachingPoints(
      [point({ transcriptQuote: "we should circle back on pricing" })],
      entries,
      turns,
    );
    expect(result.kept).toHaveLength(0);
    expect(result.dropped[0]?.reason).toBe("quote_not_found");
  });

  it("drops a quote that exists in a different turn than cited", () => {
    const result = gateCoachingPoints(
      [point({ transcriptQuote: "Let me show you our routing engine", turnIdx: 0 })],
      entries,
      turns,
    );
    expect(result.dropped[0]?.reason).toBe("quote_not_found");
  });

  it("gates each point independently", () => {
    const result = gateCoachingPoints(
      [
        point({}),
        point({ methodologyEntryNumber: "2.1", turnIdx: 0, transcriptQuote: "can you walk me through how dispatch handles a multi-stop load today?" }),
        point({ methodologyEntryNumber: "8.8" }),
      ],
      entries,
      turns,
    );
    expect(result.kept).toHaveLength(2);
    expect(result.dropped).toHaveLength(1);
  });
});

describe("quoteAppearsIn", () => {
  const turn =
    "Let me show you our routing engine — it's the fastest on the market, hands down.";

  it("accepts verbatim quotes", () => {
    expect(quoteAppearsIn("Let me show you our routing engine", turn)).toBe(
      true,
    );
  });

  it("accepts quotes with different casing, punctuation, and smart quotes", () => {
    expect(quoteAppearsIn("let me show you our routing engine!", turn)).toBe(
      true,
    );
    expect(quoteAppearsIn("it\u2019s the fastest on the market", turn)).toBe(true);
  });

  it("accepts quotes with collapsed whitespace and ellipses", () => {
    expect(
      quoteAppearsIn("Let me show you   our routing engine…", turn),
    ).toBe(true);
  });

  it("accepts near-quotes above the similarity threshold", () => {
    // One token differs ("their" vs "our") in a 12-token window ≈ 0.92
    expect(
      quoteAppearsIn(
        "Let me show you their routing engine it's the fastest on the market",
        turn,
      ),
    ).toBe(true);
  });

  it("rejects fabricated quotes", () => {
    expect(quoteAppearsIn("our pricing starts at $50k per year", turn)).toBe(
      false,
    );
    expect(quoteAppearsIn("", turn)).toBe(false);
  });

  it("rejects quotes that only share a few common words", () => {
    expect(quoteAppearsIn("show me the market data you have", turn)).toBe(
      false,
    );
  });
});
