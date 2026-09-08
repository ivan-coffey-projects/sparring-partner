import { beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, callTurns } from "@/db/schema";
import { startCall } from "@/sim/calls";
import { runRepTurn } from "@/sim/turn";
import { runAsyncMessageTurn } from "@/sim/async-turn";
import { insertFixture } from "./fixtures";

// The prospect model is the one step in each pipeline that reaches a remote
// gateway. When that gateway is down `callWithFallback` rethrows (no fallback
// model is configured by default), so this is the ordinary failure path.
const { generateProspectReply } = vi.hoisted(() => ({
  generateProspectReply: vi.fn(),
}));
vi.mock("@/llm/prospect", () => ({ generateProspectReply }));

const { analyzeRepMove } = vi.hoisted(() => ({ analyzeRepMove: vi.fn() }));
vi.mock("@/llm/analyzer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/llm/analyzer")>();
  analyzeRepMove.mockImplementation(actual.analyzeRepMove);
  return { ...actual, analyzeRepMove };
});

const GATEWAY_DOWN = new Error("fetch failed");

/** Everything a retry would read back. */
function snapshot(callId: string) {
  return {
    call: db.select().from(calls).where(eq(calls.id, callId)).get(),
    turns: db
      .select()
      .from(callTurns)
      .where(eq(callTurns.callId, callId))
      .orderBy(asc(callTurns.idx))
      .all(),
  };
}

beforeEach(() => {
  generateProspectReply.mockReset();
});

describe("turn durability when the model gateway fails", () => {
  it("leaves a live call byte-identical after a failed prospect reply", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);
    const before = snapshot(callId);

    generateProspectReply.mockRejectedValueOnce(GATEWAY_DOWN);
    await expect(
      runRepTurn(callId, "What's your budget for this?"),
    ).rejects.toThrow(GATEWAY_DOWN);

    expect(snapshot(callId)).toEqual(before);
  });

  it("leaves an async thread byte-identical after a failed prospect reply", async () => {
    const fixture = insertFixture({ channel: "sms" });
    const callId = startCall(fixture.drillId, fixture.repId);
    const before = snapshot(callId);

    generateProspectReply.mockRejectedValueOnce(GATEWAY_DOWN);
    await expect(
      runAsyncMessageTurn(
        callId,
        "It sounds like your dispatchers keep a shadow spreadsheet because the optimizer chokes on multi-stop loads — what does that cost you?",
      ),
    ).rejects.toThrow(GATEWAY_DOWN);

    expect(snapshot(callId)).toEqual(before);
  });

  it("replays the same turn cleanly once the gateway recovers", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);

    generateProspectReply.mockRejectedValueOnce(GATEWAY_DOWN);
    await expect(
      runRepTurn(callId, "What's your budget for this?"),
    ).rejects.toThrow(GATEWAY_DOWN);

    generateProspectReply.mockResolvedValueOnce({
      text: "Recovered reply.",
      concessionEvents: [],
    });
    const result = await runRepTurn(callId, "What's your budget for this?");

    // The failed attempt must not have advanced patience or left a stray line.
    expect(result.patience).toBe(54);
    const { turns } = snapshot(callId);
    expect(turns.map((t) => t.speaker)).toEqual(["prospect", "rep", "prospect"]);
    expect(turns.map((t) => t.idx)).toEqual([0, 1, 2]);
  });
});

describe("turn durability when the analyzer fails", () => {
  // The analyzer runs before any write in both pipelines. These pin that
  // ordering so a future refactor cannot quietly move a write above it.
  it("leaves a live call byte-identical", async () => {
    const fixture = insertFixture();
    const callId = startCall(fixture.drillId, fixture.repId);
    const before = snapshot(callId);

    analyzeRepMove.mockRejectedValueOnce(GATEWAY_DOWN);
    await expect(runRepTurn(callId, "What's your budget?")).rejects.toThrow(
      GATEWAY_DOWN,
    );

    expect(snapshot(callId)).toEqual(before);
    expect(generateProspectReply).not.toHaveBeenCalled();
  });

  it("leaves an async thread byte-identical", async () => {
    const fixture = insertFixture({ channel: "sms" });
    const callId = startCall(fixture.drillId, fixture.repId);
    const before = snapshot(callId);

    analyzeRepMove.mockRejectedValueOnce(GATEWAY_DOWN);
    await expect(
      runAsyncMessageTurn(callId, "What's your budget?"),
    ).rejects.toThrow(GATEWAY_DOWN);

    expect(snapshot(callId)).toEqual(before);
    expect(generateProspectReply).not.toHaveBeenCalled();
  });
});
