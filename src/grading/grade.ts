import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  methodologyEntries,
  reports,
  scorecardCriteria,
  scorecards,
  type CoachingPointRecord,
  type CriterionScoreRecord,
  type DroppedPointRecord,
} from "@/db/schema";
import { gateCoachingPoints, quoteAppearsIn } from "@/engine/citations";
import type {
  MethodologyEntryRef,
  RawCoachingPoint,
  TranscriptTurnRef,
} from "@/engine/types";
import { modelLabel } from "@/llm/models";
import { channelNoun } from "@/lib/labels";
import type { GraderOutput } from "@/llm/schemas";
import { generateGraderOutput } from "@/llm/grader-output";
import { callWithFallback } from "@/llm/with-fallback";
import {
  GRADER_STATE_TAG,
  embedStateBlock,
  type GraderStateBlock,
} from "@/llm/state-blocks";
import { deriveEngineEvents } from "@/grading/events";
import { loadCallBundle } from "@/sim/calls";

/**
 * Grades an ended call with a model that never spoke during it, then passes
 * every claim through the citation gate: a point survives only if it cites a
 * real numbered methodology entry AND quotes the transcript turn it names.
 * Uncitable coaching is dropped (and audited) — never invented.
 */
export async function gradeCall(callId: string): Promise<void> {
  const report = db
    .select()
    .from(reports)
    .where(eq(reports.callId, callId))
    .get();
  if (!report || report.status === "ready" || report.status === "grading") {
    return;
  }
  db.update(reports)
    .set({ status: "grading", error: null, gradingStartedAt: Date.now() })
    .where(eq(reports.id, report.id))
    .run();

  const bundle = loadCallBundle(callId);
  if (!bundle) throw new Error("Call not found.");
  const { call, drill, facts, turns } = bundle;
  if (call.status !== "ended") throw new Error("Call has not ended.");

  const scorecard = db
    .select()
    .from(scorecards)
    .where(eq(scorecards.id, drill.scorecardId))
    .get();
  if (!scorecard) throw new Error("Scorecard not found.");
  const criteria = db
    .select()
    .from(scorecardCriteria)
    .where(eq(scorecardCriteria.scorecardId, scorecard.id))
    .orderBy(asc(scorecardCriteria.sortOrder))
    .all();
  const entries = db
    .select()
    .from(methodologyEntries)
    .where(eq(methodologyEntries.methodologyId, scorecard.methodologyId))
    .orderBy(asc(methodologyEntries.sortOrder))
    .all();
  const entryRefs: MethodologyEntryRef[] = entries.map((e) => ({
    id: e.id,
    number: e.number,
    title: e.title,
    text: e.text,
  }));
  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const entriesByNumber = new Map(entries.map((e) => [e.number, e]));

  const turnRefs: TranscriptTurnRef[] = turns.map((t) => ({
    idx: t.idx,
    speaker: t.speaker,
    text: t.text,
  }));

  const events = deriveEngineEvents(
    call,
    turns,
    new Map(facts.map((f) => [f.id, f.label])),
  );

  const stateBlock: GraderStateBlock = {
    turns: turnRefs,
    channel: drill.channel,
    entries: entries.map((e) => ({ number: e.number, title: e.title })),
    criteria: criteria.map((c) => ({
      criterionId: c.id,
      label: c.label,
      methodologyEntryNumbers: c.methodologyEntryIds
        .map((id) => entriesById.get(id)?.number)
        .filter((n): n is string => n !== undefined),
    })),
    events,
    outcome: call.outcome ?? "unknown",
    factsUnlocked: call.unlockedFactIds.length,
    factsTotal: facts.length,
  };

  const channelContext =
    drill.channel === "call"
      ? "The conversation was a live phone call."
      : `The conversation happened over ${channelNoun(drill.channel)} — grade message craft, cadence, and channel discipline accordingly. Lines marked [system] are simulated-time annotations (waits, silences); never cite them — cite only REP and PROSPECT lines.`;

  const system = [
    "You are a sales-coaching grader reviewing a finished training conversation. You never spoke during it.",
    channelContext,
    "Grade STRICTLY against the trainer's numbered methodology below — it is the only authority you may coach from.",
    "Rules you must follow:",
    "1. Every coaching point MUST cite a numbered methodology entry that exists, and MUST quote the transcript VERBATIM from the turn you reference. Points that cannot be traced will be discarded.",
    "2. Prefer fewer, well-cited points over many vague ones.",
    "3. Include at least one strength (what the rep did right), also cited.",
    "4. Score each scorecard criterion 0–5. Back each score with a citation where one exists.",
    "5. The engine event log is ground truth for what mechanically happened (patience, unlocks, caps). Use it to find the moments that matter, then cite them from the transcript.",
    "6. Respond with a JSON object only — no markdown, no preamble.",
    'JSON shape: {"criteria":[{"criterionId":"...","score":0,"rationale":"...","citation":{"methodologyEntryNumber":"1.2","transcriptQuote":"...","turnIdx":0}|null}],"coachingPoints":[{"methodologyEntryNumber":"1.2","transcriptQuote":"...","turnIdx":0,"comment":"...","severity":"critical"|"major"|"minor"}]}',
    "",
    "# The trainer's methodology (the only citable source)",
    ...entries.map((e) => `${e.number} ${e.title} — ${e.text}`),
    "",
    "# The prospect's hidden file (what was really true)",
    ...facts.map(
      (f) =>
        `- ${f.label} [${call.unlockedFactIds.includes(f.id) ? "UNCOVERED by the rep" : "never uncovered"}]: ${f.truth}`,
    ),
    "",
    embedStateBlock(GRADER_STATE_TAG, stateBlock),
  ].join("\n");

  const transcriptText = turnRefs
    .map(
      (t) =>
        `[turn ${t.idx}] ${
          t.speaker === "rep"
            ? "REP"
            : t.speaker === "prospect"
              ? "PROSPECT"
              : "[system]"
        }: ${t.text}`,
    )
    .join("\n");

  const graded = await callWithFallback("grader", async (model) => {
    return generateGraderOutput(
      model,
      system,
      `Transcript of the call:\n${transcriptText}\n\nGrade the rep now. Return JSON only.`,
    );
  });
  const output = graded.value;

  const gated = gateAll(output, entryRefs, turnRefs);
  const droppedFromCriteria: DroppedPointRecord[] = [];
  const criteriaScores = buildCriteriaScores(
    output,
    criteria,
    entriesByNumber,
    turnRefs,
    droppedFromCriteria,
  );
  const allDropped = [...gated.dropped, ...droppedFromCriteria];

  const totalWeight = criteriaScores.reduce((acc, c) => acc + c.weight, 0);
  const overallScore =
    totalWeight > 0
      ? Math.round(
          (criteriaScores.reduce((acc, c) => acc + c.score * c.weight, 0) /
            totalWeight) *
            10,
        ) / 10
      : null;

  db.update(reports)
    .set({
      status: "ready",
      overallScore,
      criteriaScores,
      coachingPoints: gated.kept,
      droppedPoints: allDropped,
      graderModel: graded.usedFallback
        ? `openai-compatible/${graded.modelId}`
        : modelLabel("grader"),
      gradingStartedAt: null,
      gradedAt: Date.now(),
    })
    .where(eq(reports.id, report.id))
    .run();
}

interface GateAllResult {
  kept: CoachingPointRecord[];
  dropped: DroppedPointRecord[];
}

function gateAll(
  output: GraderOutput,
  entryRefs: MethodologyEntryRef[],
  turnRefs: TranscriptTurnRef[],
): GateAllResult {
  const raw: RawCoachingPoint[] = output.coachingPoints.map((p) => ({
    methodologyEntryNumber: p.methodologyEntryNumber,
    transcriptQuote: p.transcriptQuote,
    turnIdx: p.turnIdx,
    comment: p.comment,
    severity: p.severity,
  }));
  const result = gateCoachingPoints(raw, entryRefs, turnRefs);
  return {
    kept: result.kept.map((p) => ({
      methodologyEntryId: p.methodologyEntryId,
      methodologyEntryNumber: p.methodologyEntryNumber,
      methodologyEntryTitle: p.methodologyEntryTitle,
      methodologyEntryText: p.methodologyEntryText,
      transcriptQuote: p.transcriptQuote,
      turnIdx: p.turnIdx,
      comment: p.comment,
      severity: p.severity,
    })),
    dropped: result.dropped.map((d) => ({
      methodologyEntryNumber: d.point.methodologyEntryNumber,
      transcriptQuote: d.point.transcriptQuote,
      turnIdx: d.point.turnIdx,
      comment: d.point.comment,
      severity: d.point.severity,
      reason: d.reason,
    })),
  };
}

function buildCriteriaScores(
  output: GraderOutput,
  criteria: Array<typeof scorecardCriteria.$inferSelect>,
  entriesByNumber: Map<string, typeof methodologyEntries.$inferSelect>,
  turnRefs: TranscriptTurnRef[],
  droppedSink: DroppedPointRecord[],
): CriterionScoreRecord[] {
  const turnsByIdx = new Map(turnRefs.map((t) => [t.idx, t]));
  const outputById = new Map(output.criteria.map((c) => [c.criterionId, c]));

  return criteria.map((criterion) => {
    const graded = outputById.get(criterion.id);
    if (!graded) {
      return {
        criterionId: criterion.id,
        label: criterion.label,
        weight: criterion.weight,
        score: 0,
        rationale: "",
        citation: null,
      };
    }

    // The criterion's citation goes through the same gate as coaching points.
    let citation: CriterionScoreRecord["citation"] = null;
    let rationale = graded.rationale;
    if (graded.citation) {
      const entry = entriesByNumber.get(
        graded.citation.methodologyEntryNumber.trim(),
      );
      const turn = turnsByIdx.get(graded.citation.turnIdx);
      const quoteOk =
        turn !== undefined &&
        quoteAppearsIn(graded.citation.transcriptQuote, turn.text);
      if (entry && quoteOk) {
        citation = {
          methodologyEntryId: entry.id,
          methodologyEntryNumber: entry.number,
          transcriptQuote: graded.citation.transcriptQuote,
          turnIdx: graded.citation.turnIdx,
        };
      } else {
        droppedSink.push({
          methodologyEntryNumber: graded.citation.methodologyEntryNumber,
          transcriptQuote: graded.citation.transcriptQuote,
          turnIdx: graded.citation.turnIdx,
          comment: `(criterion rationale) ${graded.rationale}`,
          severity: "minor",
          reason: !entry
            ? "unknown_entry"
            : turn === undefined
              ? "bad_turn_ref"
              : "quote_not_found",
        });
        // A rationale that lost its citation is not shown as coaching.
        rationale = "";
      }
    } else {
      // No citation offered → score stands, but no uncited coaching is shown.
      rationale = "";
    }

    return {
      criterionId: criterion.id,
      label: criterion.label,
      weight: criterion.weight,
      score: Math.max(0, Math.min(5, graded.score)),
      rationale,
      citation,
    };
  });
}
