import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, callTurns, type TurnAnalysisRecord } from "@/db/schema";
import { computeTurnMetrics } from "@/engine/metrics";
import { applyPatienceTurn, patienceBand } from "@/engine/patience";
import { applyUnlockTurn } from "@/engine/unlock";
import type {
  CallOutcome,
  ConcessionLogEntry,
  PatienceBand,
  PatienceDelta,
} from "@/engine/types";
import { analyzeRepMove, type TranscriptLine } from "@/llm/analyzer";
import { generateProspectReply } from "@/llm/prospect";
import { loadCallBundle, finalizeCall } from "@/sim/calls";
import { newId } from "@/lib/ids";

export interface UnlockedFactSummary {
  id: string;
  label: string;
}

export interface RepTurnResult {
  prospectText: string;
  patience: number;
  band: PatienceBand;
  patienceDeltas: PatienceDelta[];
  newlyUnlockedFacts: UnlockedFactSummary[];
  factsUnlockedCount: number;
  factsTotal: number;
  concessionEvents: ConcessionLogEntry[];
  callStatus: "live" | "ended";
  outcome: CallOutcome | null;
}

const HANG_UP_LINE =
  "I'm going to stop you there — this isn't a good use of my time. Send me an email if you want. Goodbye.";

/**
 * The per-turn pipeline. Everything that matters — patience, unlocks,
 * concession caps, hang-ups — is decided here in code, before and after the
 * prospect model speaks.
 */
export async function runRepTurn(
  callId: string,
  repMessage: string,
): Promise<RepTurnResult> {
  const bundle = loadCallBundle(callId);
  if (!bundle) throw new Error("Call not found.");
  const { call, drill, prospect, facts, turns } = bundle;
  if (call.status !== "live") throw new Error("This call has ended.");
  if (drill.channel !== "call") {
    throw new Error("This drill runs on an async channel, not a live call.");
  }

  const transcript: TranscriptLine[] = turns
    .filter((t) => t.speaker !== "system")
    .map((t) => ({
      speaker: t.speaker as "rep" | "prospect",
      text: t.text,
    }));

  // 1. Code-computed metrics cannot be influenced by generated responses.
  const metrics = computeTurnMetrics(repMessage);

  // 2. The analyzer classifies the move (it sees the hidden file; it never speaks).
  const analysis = await analyzeRepMove(facts, transcript, repMessage);

  // 3. Patience — pure function.
  const patienceResult = applyPatienceTurn(
    call.patience,
    analysis,
    metrics,
    call.unlockedFactIds.length,
    prospect.patienceConfig,
  );

  // 4. Hidden-file unlocking — pure function.
  const unlockResult = applyUnlockTurn(
    {
      unlockedFactIds: call.unlockedFactIds,
      trust: call.trust,
      reflectionsEarned: call.reflectionsEarned,
    },
    facts,
    analysis,
  );

  const repTurnIdx = turns.length;
  const analysisRecord: TurnAnalysisRecord = {
    analysis,
    metrics,
    patience: patienceResult.value,
    patienceDeltas: patienceResult.deltas,
    newlyUnlockedFactIds: unlockResult.newlyUnlockedFactIds,
  };
  const now = Date.now();

  const newlyUnlockedFacts: UnlockedFactSummary[] = facts
    .filter((f) => unlockResult.newlyUnlockedFactIds.includes(f.id))
    .map((f) => ({ id: f.id, label: f.label }));

  /**
   * The whole turn lands in one transaction, and only once the prospect line
   * exists. Nothing is written while a remote call is still in flight, so a
   * gateway failure leaves the call exactly as the rep found it and the turn
   * is safe to retry. Persisting the rep line first would strand it without a
   * reply and desynchronise the transcript from `calls.patience`.
   */
  const commitTurn = (
    prospectText: string,
    patienceValue: number,
    concessionEvents: ConcessionLogEntry[],
  ) => {
    db.transaction((tx) => {
      tx.insert(callTurns)
        .values({
          id: newId(),
          callId,
          idx: repTurnIdx,
          speaker: "rep",
          text: repMessage,
          analysis: analysisRecord,
          createdAt: now,
        })
        .run();
      tx.insert(callTurns)
        .values({
          id: newId(),
          callId,
          idx: repTurnIdx + 1,
          speaker: "prospect",
          text: prospectText,
          analysis: null,
          createdAt: now + 1,
        })
        .run();
      tx.update(calls)
        .set({
          patience: patienceValue,
          trust: unlockResult.state.trust,
          reflectionsEarned: unlockResult.state.reflectionsEarned,
          unlockedFactIds: unlockResult.state.unlockedFactIds,
          concessionLog: [...call.concessionLog, ...concessionEvents],
        })
        .where(eq(calls.id, callId))
        .run();
    });
  };

  // 5. Hang-up: the engine ends the call before the model would even speak.
  if (patienceResult.hangUp) {
    commitTurn(HANG_UP_LINE, 0, []);
    finalizeCall(callId, "hung_up");
    return {
      prospectText: HANG_UP_LINE,
      patience: 0,
      band: "done",
      patienceDeltas: patienceResult.deltas,
      newlyUnlockedFacts,
      factsUnlockedCount: unlockResult.state.unlockedFactIds.length,
      factsTotal: facts.length,
      concessionEvents: [],
      callStatus: "ended",
      outcome: "hung_up",
    };
  }

  // 6. The prospect speaks — with locked truths withheld and caps enforced.
  const reply = await generateProspectReply({
    persona: {
      name: prospect.name,
      jobTitle: prospect.jobTitle,
      company: prospect.company,
      persona: prospect.persona,
    },
    channel: "call",
    facts,
    unlockedFactIds: unlockResult.state.unlockedFactIds,
    newlyUnlockedFactIds: unlockResult.newlyUnlockedFactIds,
    patience: patienceResult.value,
    caps: prospect.concessionCaps,
    approvedConcessionCount: call.concessionLog.filter(
      (e) => e.verdict.approved,
    ).length,
    transcript,
    repMessage,
    turnIdx: repTurnIdx,
  });

  commitTurn(reply.text, patienceResult.value, reply.concessionEvents);

  const meetingApproved = reply.concessionEvents.some(
    (e) => e.verdict.approved && e.request.type === "meeting",
  );

  let callStatus: "live" | "ended" = "live";
  let outcome: CallOutcome | null = null;
  if (meetingApproved) {
    finalizeCall(callId, "meeting_booked");
    callStatus = "ended";
    outcome = "meeting_booked";
  }

  return {
    prospectText: reply.text,
    patience: patienceResult.value,
    band: patienceBand(patienceResult.value),
    patienceDeltas: patienceResult.deltas,
    newlyUnlockedFacts,
    factsUnlockedCount: unlockResult.state.unlockedFactIds.length,
    factsTotal: facts.length,
    concessionEvents: reply.concessionEvents,
    callStatus,
    outcome,
  };
}
