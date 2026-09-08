import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  methodologyEntries,
  reviews,
  scorecardCriteria,
  scorecards,
  type CoachingPointRecord,
  type CriterionScoreRecord,
  type DroppedPointRecord,
} from "@/db/schema";
import { gateCoachingPoints, quoteAppearsIn } from "@/engine/citations";
import { engagementConfigFor } from "@/engine/channels";
import { computeWrittenMetrics } from "@/engine/written-metrics";
import { isAsyncChannel } from "@/engine/types";
import type {
  MethodologyEntryRef,
  RawCoachingPoint,
  TranscriptTurnRef,
} from "@/engine/types";
import { modelLabel } from "@/llm/models";
import { generateGraderOutput } from "@/llm/grader-output";
import { callWithFallback } from "@/llm/with-fallback";
import {
  GRADER_STATE_TAG,
  embedStateBlock,
  type GraderEngineEvent,
  type GraderStateBlock,
} from "@/llm/state-blocks";
import { channelNoun } from "@/lib/labels";

/**
 * Grades a REAL uploaded artifact with the same citation gate as training
 * sessions: every claim must cite a numbered methodology entry AND quote the
 * artifact verbatim, or it is dropped and audited. There is no hidden file
 * and no engine log — instead, code-computed message metrics give the grader
 * un-charmable ground truth about length, spam signals, and bumps.
 */
export async function gradeReview(reviewId: string): Promise<void> {
  const review = db.select().from(reviews).where(eq(reviews.id, reviewId)).get();
  if (!review || review.status === "ready" || review.status === "grading") {
    return;
  }
  db.update(reviews)
    .set({ status: "grading", error: null, gradingStartedAt: Date.now() })
    .where(eq(reviews.id, reviewId))
    .run();

  const scorecard = db
    .select()
    .from(scorecards)
    .where(eq(scorecards.id, review.scorecardId))
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

  const turnRefs: TranscriptTurnRef[] = review.turns.map((t) => ({
    idx: t.idx,
    speaker: t.speaker,
    text: t.text,
  }));

  // Code-computed ground truth per rep message.
  const events = deriveArtifactEvents(review.channel, turnRefs);

  const stateBlock: GraderStateBlock = {
    turns: turnRefs,
    channel: review.channel,
    entries: entries.map((e) => ({ number: e.number, title: e.title })),
    criteria: criteria.map((c) => ({
      criterionId: c.id,
      label: c.label,
      methodologyEntryNumbers: c.methodologyEntryIds
        .map((id) => entriesById.get(id)?.number)
        .filter((n): n is string => n !== undefined),
    })),
    events,
    outcome: "review",
    factsUnlocked: 0,
    factsTotal: 0,
  };

  const stageContext =
    review.stage === "cold"
      ? "This is COLD-stage outreach: an interest-based, low-friction ask is the right close; a hard calendar/meeting-time ask is premature."
      : "This is an ACTIVE deal: a specific, concrete scheduling ask is the right close; vague interest asks stall momentum.";

  const system = [
    `You are a sales-coaching grader reviewing a REAL ${channelNoun(review.channel)} artifact a user uploaded for feedback. This is not a simulation — it is their actual work.`,
    stageContext,
    "Grade STRICTLY against the trainer's numbered methodology below — it is the only authority you may coach from.",
    "Rules you must follow:",
    "1. Every coaching point MUST cite a numbered methodology entry that exists, and MUST quote the artifact VERBATIM from the turn you reference. Points that cannot be traced will be discarded.",
    "2. Prefer fewer, well-cited points over many vague ones.",
    "3. Include at least one strength (what the person did right), also cited.",
    "4. Score each scorecard criterion 0–5. Back each score with a citation where one exists.",
    "5. The computed-metrics event log is code-measured ground truth (message lengths, spam signals, bump phrases). Use it to find the moments that matter, then cite them from the artifact. Lines marked [system] are annotations — never cite them.",
    "6. Respond with a JSON object only — no markdown, no preamble.",
    'JSON shape: {"criteria":[{"criterionId":"...","score":0,"rationale":"...","citation":{"methodologyEntryNumber":"1.2","transcriptQuote":"...","turnIdx":0}|null}],"coachingPoints":[{"methodologyEntryNumber":"1.2","transcriptQuote":"...","turnIdx":0,"comment":"...","severity":"critical"|"major"|"minor"}]}',
    "",
    "# The methodology (the only citable source)",
    ...entries.map((e) => `${e.number} ${e.title} — ${e.text}`),
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
      `The artifact:\n${transcriptText}\n\nGrade it now. Return JSON only.`,
    );
  });
  const output = graded.value;

  const raw: RawCoachingPoint[] = output.coachingPoints.map((p) => ({
    methodologyEntryNumber: p.methodologyEntryNumber,
    transcriptQuote: p.transcriptQuote,
    turnIdx: p.turnIdx,
    comment: p.comment,
    severity: p.severity,
  }));
  const gated = gateCoachingPoints(raw, entryRefs, turnRefs);
  const kept: CoachingPointRecord[] = gated.kept.map((p) => ({
    methodologyEntryId: p.methodologyEntryId,
    methodologyEntryNumber: p.methodologyEntryNumber,
    methodologyEntryTitle: p.methodologyEntryTitle,
    methodologyEntryText: p.methodologyEntryText,
    transcriptQuote: p.transcriptQuote,
    turnIdx: p.turnIdx,
    comment: p.comment,
    severity: p.severity,
  }));
  const dropped: DroppedPointRecord[] = gated.dropped.map((d) => ({
    methodologyEntryNumber: d.point.methodologyEntryNumber,
    transcriptQuote: d.point.transcriptQuote,
    turnIdx: d.point.turnIdx,
    comment: d.point.comment,
    severity: d.point.severity,
    reason: d.reason,
  }));

  const turnsByIdx = new Map(turnRefs.map((t) => [t.idx, t]));
  const outputById = new Map(output.criteria.map((c) => [c.criterionId, c]));
  const criteriaScores: CriterionScoreRecord[] = criteria.map((criterion) => {
    const gradedCriterion = outputById.get(criterion.id);
    if (!gradedCriterion) {
      return {
        criterionId: criterion.id,
        label: criterion.label,
        weight: criterion.weight,
        score: 0,
        rationale: "",
        citation: null,
      };
    }
    let citation: CriterionScoreRecord["citation"] = null;
    let rationale = gradedCriterion.rationale;
    if (gradedCriterion.citation) {
      const entry = entriesByNumber.get(
        gradedCriterion.citation.methodologyEntryNumber.trim(),
      );
      const turn = turnsByIdx.get(gradedCriterion.citation.turnIdx);
      const quoteOk =
        turn !== undefined &&
        quoteAppearsIn(gradedCriterion.citation.transcriptQuote, turn.text);
      if (entry && quoteOk) {
        citation = {
          methodologyEntryId: entry.id,
          methodologyEntryNumber: entry.number,
          transcriptQuote: gradedCriterion.citation.transcriptQuote,
          turnIdx: gradedCriterion.citation.turnIdx,
        };
      } else {
        dropped.push({
          methodologyEntryNumber: gradedCriterion.citation.methodologyEntryNumber,
          transcriptQuote: gradedCriterion.citation.transcriptQuote,
          turnIdx: gradedCriterion.citation.turnIdx,
          comment: `(criterion rationale) ${gradedCriterion.rationale}`,
          severity: "minor",
          reason: !entry
            ? "unknown_entry"
            : turn === undefined
              ? "bad_turn_ref"
              : "quote_not_found",
        });
        rationale = "";
      }
    } else {
      rationale = "";
    }
    return {
      criterionId: criterion.id,
      label: criterion.label,
      weight: criterion.weight,
      score: Math.max(0, Math.min(5, gradedCriterion.score)),
      rationale,
      citation,
    };
  });

  const totalWeight = criteriaScores.reduce((acc, c) => acc + c.weight, 0);
  const overallScore =
    totalWeight > 0
      ? Math.round(
          (criteriaScores.reduce((acc, c) => acc + c.score * c.weight, 0) /
            totalWeight) *
            10,
        ) / 10
      : null;

  db.update(reviews)
    .set({
      status: "ready",
      overallScore,
      criteriaScores,
      coachingPoints: kept,
      droppedPoints: dropped,
      graderModel: graded.usedFallback
        ? `openai-compatible/${graded.modelId}`
        : modelLabel("grader"),
      gradingStartedAt: null,
      gradedAt: Date.now(),
    })
    .where(eq(reviews.id, reviewId))
    .run();
}

/**
 * Code-measured events over a real artifact. No analyzer, no engine state —
 * just the deterministic written metrics, so the grader starts from facts.
 */
export function deriveArtifactEvents(
  channel: (typeof reviews.$inferSelect)["channel"],
  turns: TranscriptTurnRef[],
): GraderEngineEvent[] {
  const events: GraderEngineEvent[] = [];
  const config = isAsyncChannel(channel) ? engagementConfigFor(channel) : null;
  for (const turn of turns) {
    if (turn.speaker !== "rep") continue;
    const metrics = computeWrittenMetrics(turn.text);
    if (config) {
      if (metrics.charCount >= config.hardMaxChars) {
        events.push({
          kind: "wall_of_text",
          turnIdx: turn.idx,
          charCount: metrics.charCount,
        });
      }
      if (metrics.questionCount === 0) {
        events.push({ kind: "no_question", turnIdx: turn.idx });
      }
    } else if (metrics.wordCount > 90) {
      events.push({
        kind: "monologue",
        turnIdx: turn.idx,
        wordCount: metrics.wordCount,
      });
    }
    if (metrics.spamTriggerHits.length > 0) {
      events.push({ kind: "spam_signals", turnIdx: turn.idx });
    }
    if (metrics.guiltTripHits.length > 0) {
      events.push({ kind: "guilt_trip", turnIdx: turn.idx });
    }
    if (metrics.questionCount >= 3) {
      events.push({ kind: "stacked_questions", turnIdx: turn.idx });
    }
    if (metrics.selfFocusRatio > 0.6) {
      events.push({ kind: "self_focused", turnIdx: turn.idx });
    }
  }
  return events.sort((a, b) => a.turnIdx - b.turnIdx);
}
