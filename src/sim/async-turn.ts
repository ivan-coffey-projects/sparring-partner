import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  calls,
  callTurns,
  type TurnAnalysisRecord,
  type TurnMeta,
} from "@/db/schema";
import { engagementConfigFor } from "@/engine/channels";
import {
  applyEngagementTurn,
  decideReply,
  engagementBand,
} from "@/engine/engagement";
import { computeWrittenMetrics } from "@/engine/written-metrics";
import { applyUnlockTurn } from "@/engine/unlock";
import {
  isAsyncChannel,
  type AsyncChannel,
  type CallOutcome,
  type ChannelState,
  type ConcessionLogEntry,
  type PatienceBand,
  type PatienceDelta,
} from "@/engine/types";
import { analyzeRepMove, type TranscriptLine } from "@/llm/analyzer";
import { generateProspectReply } from "@/llm/prospect";
import { loadCallBundle, finalizeCall } from "@/sim/calls";
import { newId } from "@/lib/ids";
import { durationLabel } from "@/lib/duration";
import type { UnlockedFactSummary } from "@/sim/turn";

export interface ThreadTurnPayload {
  id: string;
  speaker: "rep" | "prospect" | "system";
  text: string;
  meta: TurnMeta | null;
}

export interface AsyncTurnResult {
  /** Turns the server added beyond the rep's own message. */
  newTurns: ThreadTurnPayload[];
  engagement: number;
  band: PatienceBand;
  deltas: PatienceDelta[];
  newlyUnlockedFacts: UnlockedFactSummary[];
  factsUnlockedCount: number;
  factsTotal: number;
  concessionEvents: ConcessionLogEntry[];
  replied: boolean;
  delayMinutes: number;
  simClockMinutes: number;
  callStatus: "live" | "ended";
  outcome: CallOutcome | null;
}

const INITIAL_STATE: ChannelState = {
  simClockMinutes: 0,
  lastRepMessageAtMinutes: null,
  unansweredStreak: 0,
};

/** Channel-appropriate explicit opt-out. DMs block; SMS/email say it. */
function optOutTurn(
  channel: AsyncChannel,
  prospectName: string,
): { speaker: "prospect" | "system"; text: string } {
  switch (channel) {
    case "sms":
      return { speaker: "prospect", text: "STOP" };
    case "email":
      return {
        speaker: "prospect",
        text: "Please remove me from your list. I'm not interested.",
      };
    case "dm_instagram":
    case "dm_linkedin":
      return { speaker: "system", text: `${prospectName} has blocked you.` };
    default: {
      const exhaustive: never = channel;
      throw new Error(`Unhandled channel: ${String(exhaustive)}`);
    }
  }
}

/**
 * One rep message on an async channel. Same spine as the live-call pipeline —
 * code metrics, analyzer read, pure engine, then (maybe) the prospect model —
 * with one channel-defining difference: the realistic outcome of a bad
 * message is SILENCE, decided in code before the model could ever speak.
 */
export async function runAsyncMessageTurn(
  callId: string,
  repMessage: string,
  subject?: string,
): Promise<AsyncTurnResult> {
  const bundle = loadCallBundle(callId);
  if (!bundle) throw new Error("Thread not found.");
  const { call, drill, prospect, facts, turns } = bundle;
  if (call.status !== "live") throw new Error("This thread has ended.");
  const channel = drill.channel;
  if (!isAsyncChannel(channel)) {
    throw new Error("This drill is a live call, not an async thread.");
  }
  const config = engagementConfigFor(channel);
  const state = call.channelState ?? INITIAL_STATE;

  const transcript: TranscriptLine[] = turns
    .filter((t) => t.speaker !== "system")
    .map((t) => ({ speaker: t.speaker as "rep" | "prospect", text: t.text }));

  const isFirstTouch = !turns.some((t) => t.speaker === "rep");
  const isFollowUpIntoSilence = state.unansweredStreak >= 1;

  // 1. Code-computed written metrics are independent of generated responses.
  const metrics = computeWrittenMetrics(repMessage, subject);

  // 2. The analyzer classifies the move, including the written read.
  const analysis = await analyzeRepMove(facts, transcript, repMessage, {
    channel,
    isFirstTouch,
    isFollowUpIntoSilence,
  });

  // 3. Engagement — pure function over research-derived channel params.
  const engagement = applyEngagementTurn(
    call.patience,
    {
      analysis,
      metrics,
      isFirstTouch,
      isFollowUpIntoSilence,
      minutesSinceLastRepMessage:
        state.lastRepMessageAtMinutes === null
          ? null
          : state.simClockMinutes - state.lastRepMessageAtMinutes,
    },
    config,
  );

  // 4. Hidden-file unlocking — identical mechanics to the live call.
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
  const now = Date.now();
  const analysisRecord: TurnAnalysisRecord = {
    analysis,
    metrics,
    patience: engagement.value,
    patienceDeltas: engagement.deltas,
    newlyUnlockedFactIds: unlockResult.newlyUnlockedFactIds,
  };
  const newlyUnlockedFacts: UnlockedFactSummary[] = facts
    .filter((f) => unlockResult.newlyUnlockedFactIds.includes(f.id))
    .map((f) => ({ id: f.id, label: f.label }));

  let nextState: ChannelState = {
    simClockMinutes: state.simClockMinutes,
    lastRepMessageAtMinutes: state.simClockMinutes,
    unansweredStreak: state.unansweredStreak + 1,
  };

  // Turns are staged in memory and written by `persistCall` in a single
  // transaction. Nothing touches the database while the prospect model is
  // still in flight, so a gateway failure leaves the thread exactly as the
  // rep found it — including `unansweredStreak`, which a partial write would
  // otherwise desynchronise from the visible transcript.
  const newTurns: ThreadTurnPayload[] = [];
  const pushTurn = (
    speaker: "prospect" | "system",
    text: string,
    meta: TurnMeta | null,
  ) => {
    newTurns.push({ id: newId(), speaker, text, meta });
  };

  const persistCall = (
    patienceValue: number,
    concessionEvents: ConcessionLogEntry[] = [],
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
          meta: subject ? { subject } : null,
          createdAt: now,
        })
        .run();
      newTurns.forEach((turn, offset) => {
        tx.insert(callTurns)
          .values({
            id: turn.id,
            callId,
            idx: repTurnIdx + 1 + offset,
            speaker: turn.speaker,
            text: turn.text,
            analysis: null,
            meta: turn.meta,
            createdAt: now + 1 + offset,
          })
          .run();
      });
      tx.update(calls)
        .set({
          patience: patienceValue,
          trust: unlockResult.state.trust,
          reflectionsEarned: unlockResult.state.reflectionsEarned,
          unlockedFactIds: unlockResult.state.unlockedFactIds,
          concessionLog: [...call.concessionLog, ...concessionEvents],
          channelState: nextState,
        })
        .where(eq(calls.id, callId))
        .run();
    });
  };

  const baseResult = {
    engagement: engagement.value,
    band: engagementBand(engagement.value),
    deltas: engagement.deltas,
    newlyUnlockedFacts,
    factsUnlockedCount: unlockResult.state.unlockedFactIds.length,
    factsTotal: facts.length,
    simClockMinutes: nextState.simClockMinutes,
  };

  // 5a. Explicit opt-out: the engine ends the thread; the "reply" is the
  // channel's version of STOP. The prospect model never speaks.
  if (engagement.terminal === "opted_out") {
    const line = optOutTurn(channel, prospect.name);
    pushTurn(line.speaker, line.text, null);
    persistCall(engagement.value);
    finalizeCall(callId, "opted_out");
    return {
      ...baseResult,
      newTurns,
      concessionEvents: [],
      replied: false,
      delayMinutes: 0,
      callStatus: "ended",
      outcome: "opted_out",
    };
  }

  // 5b. Engagement floor without a push: the thread just dies.
  if (engagement.terminal === "ghosted") {
    pushTurn("system", "Delivered. Read. No reply is coming.", null);
    persistCall(engagement.value);
    finalizeCall(callId, "ghosted");
    return {
      ...baseResult,
      newTurns,
      concessionEvents: [],
      replied: false,
      delayMinutes: 0,
      callStatus: "ended",
      outcome: "ghosted",
    };
  }

  // 6. Reply-or-silence — deterministic, decided before the model speaks.
  const decision = decideReply(
    engagement.value,
    nextState.unansweredStreak,
    config,
  );

  if (!decision.replies) {
    if (decision.terminal === "ghosted") {
      pushTurn("system", "Delivered. Read. No reply is coming.", null);
      persistCall(engagement.value);
      finalizeCall(callId, "ghosted");
      return {
        ...baseResult,
        newTurns,
        concessionEvents: [],
        replied: false,
        delayMinutes: 0,
        callStatus: "ended",
        outcome: "ghosted",
      };
    }
    // Silence. The rep decides what to do with it — wait, follow up, or quit.
    persistCall(engagement.value);
    return {
      ...baseResult,
      newTurns,
      concessionEvents: [],
      replied: false,
      delayMinutes: 0,
      callStatus: "live",
      outcome: null,
    };
  }

  // 7. The prospect replies — locked truths withheld, caps enforced.
  const reply = await generateProspectReply({
    persona: {
      name: prospect.name,
      jobTitle: prospect.jobTitle,
      company: prospect.company,
      persona: prospect.persona,
    },
    channel,
    facts,
    unlockedFactIds: unlockResult.state.unlockedFactIds,
    newlyUnlockedFactIds: unlockResult.newlyUnlockedFactIds,
    patience: engagement.value,
    caps: prospect.concessionCaps,
    approvedConcessionCount: call.concessionLog.filter(
      (e) => e.verdict.approved,
    ).length,
    transcript,
    repMessage,
    turnIdx: repTurnIdx,
  });

  nextState = {
    simClockMinutes: nextState.simClockMinutes + decision.delayMinutes,
    lastRepMessageAtMinutes: nextState.lastRepMessageAtMinutes,
    unansweredStreak: 0,
  };
  pushTurn("prospect", reply.text, { delayMinutes: decision.delayMinutes });
  persistCall(engagement.value, reply.concessionEvents);

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
    ...baseResult,
    simClockMinutes: nextState.simClockMinutes,
    newTurns,
    concessionEvents: reply.concessionEvents,
    replied: true,
    delayMinutes: decision.delayMinutes,
    callStatus,
    outcome,
  };
}

export interface WaitResult {
  turn: ThreadTurnPayload;
  simClockMinutes: number;
}

/**
 * The rep lets simulated time pass. Waiting is never penalized — it's how
 * follow-up spacing (a graded skill) becomes possible at all.
 */
export function runWaitTurn(callId: string, minutes: number): WaitResult {
  const bundle = loadCallBundle(callId);
  if (!bundle) throw new Error("Thread not found.");
  const { call, drill, turns } = bundle;
  if (call.status !== "live") throw new Error("This thread has ended.");
  if (!isAsyncChannel(drill.channel)) {
    throw new Error("Waiting only applies to async threads.");
  }
  const state = call.channelState ?? INITIAL_STATE;
  const clamped = Math.max(5, Math.min(minutes, 14 * 24 * 60));

  const nextState: ChannelState = {
    ...state,
    simClockMinutes: state.simClockMinutes + clamped,
  };
  const id = newId();
  const meta: TurnMeta = { waitedMinutes: clamped };
  const text = `You wait ${durationLabel(clamped)}. Nothing arrives.`;
  db.insert(callTurns)
    .values({
      id,
      callId,
      idx: turns.length,
      speaker: "system",
      text,
      analysis: null,
      meta,
      createdAt: Date.now(),
    })
    .run();
  db.update(calls)
    .set({ channelState: nextState })
    .where(eq(calls.id, callId))
    .run();

  return {
    turn: { id, speaker: "system", text, meta },
    simClockMinutes: nextState.simClockMinutes,
  };
}
