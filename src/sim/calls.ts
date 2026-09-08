import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  calls,
  callTurns,
  drills,
  hiddenFacts,
  prospects,
} from "@/db/schema";
import {
  isAsyncChannel,
  type CallOutcome,
  type HiddenFactDefinition,
} from "@/engine/types";
import { newId } from "@/lib/ids";
import { onCallEnded } from "@/grading/queue";

/** Creates a live call for a drill and seeds the prospect's opening line. */
export function startCall(drillId: string, repId: string): string {
  const drill = db.select().from(drills).where(eq(drills.id, drillId)).get();
  if (!drill) throw new Error("Drill not found.");
  const prospect = db
    .select()
    .from(prospects)
    .where(eq(prospects.id, drill.prospectId))
    .get();
  if (!prospect) throw new Error("Prospect not found.");

  const callId = newId();
  const now = Date.now();
  const async = isAsyncChannel(drill.channel);
  db.insert(calls)
    .values({
      id: callId,
      drillId,
      repId,
      status: "live",
      outcome: null,
      patience: prospect.patienceConfig.initial,
      trust: 0,
      reflectionsEarned: 0,
      unlockedFactIds: [],
      concessionLog: [],
      channelState: async
        ? { simClockMinutes: 0, lastRepMessageAtMinutes: null, unansweredStreak: 0 }
        : null,
      startedAt: now,
      endedAt: null,
    })
    .run();
  // Async cold-outreach drills leave the opening to the rep: an empty
  // openingLine means the thread starts blank. A non-empty one models a
  // warm inbound (story reply, inbound text) where the prospect speaks first.
  if (prospect.openingLine.trim().length > 0) {
    db.insert(callTurns)
      .values({
        id: newId(),
        callId,
        idx: 0,
        speaker: "prospect",
        text: prospect.openingLine,
        analysis: null,
        meta: null,
        createdAt: now,
      })
      .run();
  } else if (!async) {
    throw new Error("A live-call prospect needs an opening line.");
  }
  return callId;
}

/** Marks a call ended and kicks off grading. Idempotent per call. */
export function finalizeCall(callId: string, outcome: CallOutcome): void {
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!call || call.status === "ended") return;
  db.update(calls)
    .set({ status: "ended", outcome, endedAt: Date.now() })
    .where(eq(calls.id, callId))
    .run();
  onCallEnded(callId);
}

export interface CallBundle {
  call: typeof calls.$inferSelect;
  drill: typeof drills.$inferSelect;
  prospect: typeof prospects.$inferSelect;
  facts: HiddenFactDefinition[];
  turns: Array<typeof callTurns.$inferSelect>;
}

/** Loads everything the turn pipeline needs for one call. */
export function loadCallBundle(callId: string): CallBundle | null {
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!call) return null;
  const drill = db
    .select()
    .from(drills)
    .where(eq(drills.id, call.drillId))
    .get();
  if (!drill) return null;
  const prospect = db
    .select()
    .from(prospects)
    .where(eq(prospects.id, drill.prospectId))
    .get();
  if (!prospect) return null;
  const factRows = db
    .select()
    .from(hiddenFacts)
    .where(eq(hiddenFacts.prospectId, prospect.id))
    .orderBy(asc(hiddenFacts.sortOrder))
    .all();
  const turns = db
    .select()
    .from(callTurns)
    .where(eq(callTurns.callId, callId))
    .orderBy(asc(callTurns.idx))
    .all();
  return {
    call,
    drill,
    prospect,
    facts: factRows.map((f) => ({
      id: f.id,
      label: f.label,
      topic: f.topic,
      truth: f.truth,
      politeLie: f.politeLie,
      rule: f.unlockRule,
    })),
    turns,
  };
}
