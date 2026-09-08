import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports, scorecardCriteria } from "@/db/schema";
import { startCall, finalizeCall } from "@/sim/calls";
import { runRepTurn } from "@/sim/turn";
import { gradeCall } from "@/grading/grade";
import { insertFixture } from "./fixtures";

// Scripted grader: two citable points, two fabrications. The citation gate
// must keep exactly the citable ones. Other roles use the standard mocks.
const SCRIPTED_GRADER_OUTPUT = {
  criteria: [] as unknown[],
  coachingPoints: [
    {
      // VALID: real entry, verbatim quote from turn 1 (rep's blunt question).
      methodologyEntryNumber: "5.1",
      transcriptQuote: "What's your budget for this?",
      turnIdx: 1,
      comment: "Cold qualification before earning it.",
      severity: "major",
    },
    {
      // VALID: real entry, verbatim quote from turn 3 (rep's reflection).
      methodologyEntryNumber: "2.1",
      transcriptQuote: "It sounds like your dispatchers keep a shadow spreadsheet",
      turnIdx: 3,
      comment: "Strong reflection — this opened the door.",
      severity: "minor",
    },
    {
      // INVALID: methodology entry 9.9 does not exist.
      methodologyEntryNumber: "9.9",
      transcriptQuote: "What's your budget for this?",
      turnIdx: 1,
      comment: "Invented methodology reference.",
      severity: "critical",
    },
    {
      // INVALID: quote never said in turn 1.
      methodologyEntryNumber: "5.1",
      transcriptQuote: "our pricing starts at fifty thousand dollars a year",
      turnIdx: 1,
      comment: "Fabricated quote.",
      severity: "major",
    },
  ],
};

vi.mock("@/llm/models", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/llm/models")>();
  const { defineMockModel } = await import("@/llm/mock");
  return {
    ...original,
    resolveModel: (role: "prospect" | "analyzer" | "grader") => {
      if (role === "grader") {
        return defineMockModel("scripted-grader", () => {
          const output = {
            ...SCRIPTED_GRADER_OUTPUT,
            criteria: currentCriteria,
          };
          return { text: JSON.stringify(output) };
        });
      }
      return original.resolveModel(role);
    },
  };
});

// Populated per-test so the scripted grader can reference real criterion ids.
let currentCriteria: Array<{
  criterionId: string;
  score: number;
  rationale: string;
  citation: {
    methodologyEntryNumber: string;
    transcriptQuote: string;
    turnIdx: number;
  } | null;
}> = [];

async function buildEndedCall() {
  const fixture = insertFixture();
  const callId = startCall(fixture.drillId, fixture.repId);
  // turn 1: blunt question → polite lie (turn 2)
  await runRepTurn(callId, "What's your budget for this?");
  // turn 3: accurate reflection → unlock (turn 4 reply)
  await runRepTurn(
    callId,
    "It sounds like your dispatchers keep a shadow spreadsheet because the optimizer chokes on multi-stop loads — that must sting after recommending RouteMaster.",
  );
  finalizeCall(callId, "rep_ended");
  return { fixture, callId };
}

describe("grading pipeline with the citation gate", () => {
  it("keeps only citable points; fabrications are dropped and audited", async () => {
    const { fixture, callId } = await buildEndedCall();

    const rows = db
      .select()
      .from(scorecardCriteria)
      .where(eq(scorecardCriteria.scorecardId, fixture.scorecardId))
      .all();

    currentCriteria = [
      {
        criterionId: rows[0].id,
        score: 2,
        rationale: "Qualified cold instead of earning it.",
        citation: {
          methodologyEntryNumber: "5.1",
          transcriptQuote: "What's your budget for this?",
          turnIdx: 1,
        },
      },
      {
        criterionId: rows[1].id,
        score: 4.5,
        rationale: "Reflections were accurate and well-timed.",
        citation: {
          // INVALID citation: fabricated quote → rationale must be suppressed.
          methodologyEntryNumber: "2.1",
          transcriptQuote: "you clearly have no idea what you are doing",
          turnIdx: 3,
        },
      },
      {
        criterionId: rows[2].id,
        score: 3,
        rationale: "Turns stayed short.",
        citation: null,
      },
    ];

    await gradeCall(callId);

    const report = db
      .select()
      .from(reports)
      .where(eq(reports.callId, callId))
      .get();
    expect(report?.status).toBe("ready");

    // Coaching points: exactly the two citable ones survive.
    expect(report?.coachingPoints).toHaveLength(2);
    const keptNumbers = report!.coachingPoints!.map(
      (p) => p.methodologyEntryNumber,
    );
    expect(keptNumbers).toEqual(["5.1", "2.1"]);
    // Gated points carry the resolved entry text.
    expect(report!.coachingPoints![0].methodologyEntryTitle).toBe(
      "Qualify with permission",
    );

    // Dropped: 2 coaching fabrications + 1 invalid criterion citation.
    expect(report?.droppedPoints).toHaveLength(3);
    const reasons = report!.droppedPoints!.map((d) => d.reason).sort();
    expect(reasons).toEqual([
      "quote_not_found",
      "quote_not_found",
      "unknown_entry",
    ]);

    // Criteria: valid citation kept; invalid one → score stands, rationale gone.
    const scores = report!.criteriaScores!;
    expect(scores[0].citation?.methodologyEntryNumber).toBe("5.1");
    expect(scores[0].rationale).toContain("Qualified cold");
    expect(scores[1].score).toBe(4.5);
    expect(scores[1].citation).toBeNull();
    expect(scores[1].rationale).toBe("");
    expect(scores[2].citation).toBeNull();

    // Overall = weighted mean: (2×1.5 + 4.5×1.5 + 3×1) / 4 = 3.2
    expect(report?.overallScore).toBe(3.2);
  });

  it("finalizeCall creates a pending report that the queue grades", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);
    await runRepTurn(callId, "What's your budget for this?");
    currentCriteria = [];
    finalizeCall(callId, "rep_ended");

    const pending = db
      .select()
      .from(reports)
      .where(eq(reports.callId, callId))
      .get();
    expect(pending).toBeDefined();

    await vi.waitFor(
      () => {
        const row = db
          .select()
          .from(reports)
          .where(eq(reports.callId, callId))
          .get();
        expect(row?.status).toBe("ready");
      },
      { timeout: 5000 },
    );
  });
});
