import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { calls, callTurns } from "@/db/schema";
import { startCall } from "@/sim/calls";
import { runAsyncMessageTurn, runWaitTurn } from "@/sim/async-turn";
import { insertFixture } from "./fixtures";

function allTurns(callId: string) {
  return db
    .select()
    .from(callTurns)
    .where(eq(callTurns.callId, callId))
    .orderBy(asc(callTurns.idx))
    .all();
}

function startSmsThread() {
  const fixture = insertFixture({ channel: "sms", openingLine: "" });
  const callId = startCall(fixture.drillId, fixture.repId);
  return { fixture, callId };
}

const GOOD_OPENER =
  "Hey Dana — Jamie from Atlas Freight. Heard your dispatch is re-planning at 5am. Worth a quick look?";

const AWFUL_WALL =
  "Our platform is the market-leading routing solution and we offer free onboarding with a guarantee of results. We built our platform to deliver best-in-class outcomes for carriers of every size across every lane, and our customers love the way we provide continuous optimization, automated load balancing, and enterprise-grade analytics dashboards for every stakeholder in the organization.";

describe("async thread pipeline (SMS, mock models)", () => {
  it("starts blank when the prospect has no opening line", () => {
    const { callId } = startSmsThread();
    expect(allTurns(callId)).toHaveLength(0);
    const call = db.select().from(calls).where(eq(calls.id, callId)).get();
    expect(call?.channelState).toEqual({
      simClockMinutes: 0,
      lastRepMessageAtMinutes: null,
      unansweredStreak: 0,
    });
  });

  it("replies to a short, relevant opener with a simulated delay", async () => {
    const { callId } = startSmsThread();
    const result = await runAsyncMessageTurn(callId, GOOD_OPENER);
    expect(result.replied).toBe(true);
    expect(result.delayMinutes).toBeGreaterThan(0);
    expect(result.callStatus).toBe("live");
    const turns = allTurns(callId);
    expect(turns).toHaveLength(2);
    expect(turns[1].speaker).toBe("prospect");
    expect(turns[1].meta?.delayMinutes).toBe(result.delayMinutes);
    const call = db.select().from(calls).where(eq(calls.id, callId)).get();
    expect(call?.channelState?.unansweredStreak).toBe(0);
    expect(call?.channelState?.simClockMinutes).toBe(result.delayMinutes);
  });

  it("answers a pitch-first wall of text with silence, not an annoyed reply", async () => {
    const { callId } = startSmsThread();
    const result = await runAsyncMessageTurn(callId, AWFUL_WALL);
    expect(result.replied).toBe(false);
    expect(result.callStatus).toBe("live");
    expect(result.engagement).toBeLessThan(40);
    const reasons = result.deltas.map((d) => d.reason);
    expect(reasons).toContain("wall_of_text");
    expect(reasons).toContain("pitch_first_touch");
    // Only the rep's message exists — nothing came back.
    expect(allTurns(callId)).toHaveLength(1);
  });

  it("ghosts for good when bare bumps pile into the silence", async () => {
    const { callId } = startSmsThread();
    await runAsyncMessageTurn(callId, AWFUL_WALL);
    const bump = await runAsyncMessageTurn(callId, "Just following up.");
    expect(bump.callStatus).toBe("ended");
    expect(bump.outcome).toBe("ghosted");
    const turns = allTurns(callId);
    expect(turns.at(-1)?.speaker).toBe("system");
    expect(turns.at(-1)?.text).toContain("No reply");
  });

  it("gets an explicit STOP when the rep pressures a cold prospect", async () => {
    const { callId } = startSmsThread();
    await runAsyncMessageTurn(callId, AWFUL_WALL);
    const pushed = await runAsyncMessageTurn(
      callId,
      "I need an answer today — this offer expires tonight. What time works?",
    );
    expect(pushed.callStatus).toBe("ended");
    expect(pushed.outcome).toBe("opted_out");
    const turns = allTurns(callId);
    expect(turns.at(-1)?.speaker).toBe("prospect");
    expect(turns.at(-1)?.text).toBe("STOP");
  });

  it("revives a quiet thread with a patient, value-adding follow-up", async () => {
    const { callId } = startSmsThread();
    const first = await runAsyncMessageTurn(
      callId,
      "We built a routing tool. It cuts costs a lot.",
    );
    expect(first.replied).toBe(false);
    expect(first.callStatus).toBe("live");

    const wait = runWaitTurn(callId, 48 * 60);
    expect(wait.turn.speaker).toBe("system");
    expect(wait.turn.meta?.waitedMinutes).toBe(48 * 60);

    const followUp = await runAsyncMessageTurn(
      callId,
      "Heard your dispatchers keep a shadow spreadsheet for multi-stop loads. Worth a quick look?",
    );
    expect(followUp.deltas.map((d) => d.reason)).toContain("patient_follow_up");
    expect(followUp.replied).toBe(true);
    expect(followUp.callStatus).toBe("live");
  });

  it("carries the hidden-file mechanics over email, subject included", async () => {
    const fixture = insertFixture({ channel: "email", openingLine: "" });
    const callId = startCall(fixture.drillId, fixture.repId);
    const result = await runAsyncMessageTurn(
      callId,
      "Sounds like the real budget is $78k earmarked in the ops-modernization line for routing software. If I'm reading that right, is fixing multi-stop worth a look this quarter?",
      "routing budget",
    );
    expect(result.newlyUnlockedFacts.map((f) => f.label)).toContain(
      "The actual budget",
    );
    expect(result.replied).toBe(true);
    const turns = allTurns(callId);
    expect(turns[0].meta?.subject).toBe("routing budget");
    // The unlocked truth is spoken in the reply, first person.
    expect(turns[1].text).toContain("78");
  });

  it("books a meeting over text once it is earned — caps still absolute", async () => {
    const { callId } = startSmsThread();
    await runAsyncMessageTurn(
      callId,
      "Sounds like the real budget is $78k earmarked in the ops-modernization line — that right?",
    );
    await runAsyncMessageTurn(
      callId,
      "Seems like RouteMaster is failing and dispatchers keep a shadow spreadsheet for multi-stop loads.",
    );
    const close = await runAsyncMessageTurn(
      callId,
      "Given the shadow spreadsheet mess, worth a quick call? I can book a time this week.",
    );
    expect(close.concessionEvents.some((e) => e.verdict.approved)).toBe(true);
    expect(close.outcome).toBe("meeting_booked");
    expect(close.callStatus).toBe("ended");
  });

  it("refuses a meeting ask before facts are earned, even over text", async () => {
    const { callId } = startSmsThread();
    const result = await runAsyncMessageTurn(
      callId,
      "Hey Dana — Jamie here. Worth a quick look? Happy to book a meeting this week.",
    );
    expect(result.replied).toBe(true);
    const rejected = result.concessionEvents.filter((e) => !e.verdict.approved);
    expect(rejected.length).toBeGreaterThan(0);
    expect(result.outcome).not.toBe("meeting_booked");
  });
});
