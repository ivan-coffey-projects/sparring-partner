import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls } from "@/db/schema";
import { startCall } from "@/sim/calls";
import { runRepTurn } from "@/sim/turn";
import {
  BUDGET_LIE,
  BUDGET_TRUTH,
  INCUMBENT_TRUTH,
  insertFixture,
} from "./fixtures";

const ACCURATE_INCUMBENT_REFLECTION =
  "It sounds like your dispatchers keep a shadow spreadsheet because the optimizer chokes on multi-stop loads — that must sting after recommending RouteMaster.";
const ACCURATE_BUDGET_REFLECTION =
  "Reading between the lines, it seems the real budget is earmarked inside the ops-modernization line for routing software this fiscal year.";

describe("turn pipeline (mock models)", () => {
  it("gives the polite lie to a blunt qualifying question and drains patience", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    const result = await runRepTurn(callId, "What's your budget for this?");

    expect(result.prospectText).toBe(BUDGET_LIE);
    expect(result.prospectText).not.toContain("$78k");
    // blunt question: 62 - 8 = 54
    expect(result.patience).toBe(54);
    expect(result.patienceDeltas).toEqual([
      { reason: "blunt_question", amount: -8 },
    ]);
    expect(result.newlyUnlockedFacts).toEqual([]);
    expect(result.callStatus).toBe("live");
  });

  it("gives the truth to an accurate reflection (fact unlocks, patience regens)", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    const result = await runRepTurn(callId, ACCURATE_INCUMBENT_REFLECTION);

    expect(result.newlyUnlockedFacts.map((f) => f.label)).toContain(
      "The embarrassed incumbent",
    );
    expect(result.prospectText).toContain(INCUMBENT_TRUTH);
    expect(result.patience).toBeGreaterThan(62);
    expect(result.callStatus).toBe("live");
  });

  it("hangs up when a monologue drains patience to zero", async () => {
    const fixture = insertFixture({
      patienceConfig: {
        initial: 20,
        monologueWordThreshold: 50,
        monologuePenaltyPerWord: 0.5,
      },
    });
    const callId = startCall(fixture.drillId, fixture.repId);

    const monologue = Array(150).fill("word").join(" ");
    const result = await runRepTurn(callId, monologue);

    expect(result.patience).toBe(0);
    expect(result.band).toBe("done");
    expect(result.callStatus).toBe("ended");
    expect(result.outcome).toBe("hung_up");
    expect(result.prospectText).toContain("Goodbye");

    const call = db.select().from(calls).where(eq(calls.id, callId)).get();
    expect(call?.status).toBe("ended");
    expect(call?.outcome).toBe("hung_up");

    await expect(runRepTurn(callId, "hello?")).rejects.toThrow(
      "This call has ended",
    );
  });

  it("rejects a meeting ask before it is earned (hard cap, not charm)", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    const result = await runRepTurn(
      callId,
      "This has been great — could we book a meeting next week to go deeper?",
    );

    expect(result.concessionEvents).toHaveLength(1);
    expect(result.concessionEvents[0].request.type).toBe("meeting");
    expect(result.concessionEvents[0].verdict.approved).toBe(false);
    expect(result.callStatus).toBe("live");
    expect(result.outcome).toBeNull();
    // The decline reply must not contain commitment language.
    expect(result.prospectText.toLowerCase()).toContain("hold off");
  });

  it("approves a meeting after two facts are earned, ending the call as a win", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    await runRepTurn(callId, ACCURATE_INCUMBENT_REFLECTION);
    await runRepTurn(callId, ACCURATE_BUDGET_REFLECTION);

    const midCall = db.select().from(calls).where(eq(calls.id, callId)).get();
    expect(midCall?.unlockedFactIds).toHaveLength(2);

    const result = await runRepTurn(
      callId,
      "Given the peak-season clock, would it be worth a conversation with your ops lead in the room? I can bring the multi-stop analysis.",
    );

    expect(
      result.concessionEvents.some(
        (e) => e.request.type === "meeting" && e.verdict.approved,
      ),
    ).toBe(true);
    expect(result.callStatus).toBe("ended");
    expect(result.outcome).toBe("meeting_booked");

    const call = db.select().from(calls).where(eq(calls.id, callId)).get();
    expect(call?.outcome).toBe("meeting_booked");
  });

  it("persists engine state on the call row turn over turn", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    await runRepTurn(callId, "What's your budget for this?");
    const call = db.select().from(calls).where(eq(calls.id, callId)).get();
    expect(call?.patience).toBe(54);
    expect(call?.trust).toBeLessThan(0); // blunt question spends trust
    expect(call?.unlockedFactIds).toEqual([]);
  });

  it("never leaks a locked truth even when asked directly about every topic", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    const probes = [
      "What's your budget for this?",
      "Who makes the final decision on this?",
      "What's your timeline for deciding?",
    ];
    for (const probe of probes) {
      const result = await runRepTurn(callId, probe);
      expect(result.prospectText).not.toContain("$78k");
      expect(result.prospectText).not.toContain("RouteMaster");
      expect(result.prospectText).not.toContain("ten weeks");
      if (result.callStatus === "ended") break;
    }
    expect(BUDGET_TRUTH).toContain("$78k"); // sanity: the truth is leakable in principle
  });
});
