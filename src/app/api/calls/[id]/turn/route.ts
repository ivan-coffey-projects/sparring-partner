import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls } from "@/db/schema";
import { getCurrentUser } from "@/auth/session";
import { runRepTurn } from "@/sim/turn";
import {
  uiMessageText,
  type SparringUIMessage,
} from "@/lib/chat-message";
import { isMockMode } from "@/llm/models";

export const maxDuration = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One rep turn. The prospect's reply is fully generated and validated
 * (concession caps, commitment scan) BEFORE streaming begins — the client
 * sees a smooth stream, the engine keeps a hard guarantee.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "rep") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: callId } = await params;
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!call || call.repId !== user.id) {
    return Response.json({ error: "Call not found" }, { status: 404 });
  }
  if (call.status !== "live") {
    return Response.json({ error: "This call has ended" }, { status: 409 });
  }

  const body = (await request.json()) as { messages?: SparringUIMessage[] };
  const lastMessage = body.messages?.at(-1);
  const repMessage = lastMessage ? uiMessageText(lastMessage).trim() : "";
  if (!repMessage) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }

  const stream = createUIMessageStream<SparringUIMessage>({
    execute: async ({ writer }) => {
      const result = await runRepTurn(callId, repMessage);

      writer.write({ type: "start" });
      writer.write({
        type: "data-turn-meta",
        data: {
          patience: result.patience,
          band: result.band,
          deltas: result.patienceDeltas,
          unlocked: result.newlyUnlockedFacts,
          factsUnlockedCount: result.factsUnlockedCount,
          factsTotal: result.factsTotal,
        },
      });
      for (const event of result.concessionEvents) {
        writer.write({
          type: "data-concession",
          data: {
            concessionType: event.request.type,
            approved: event.verdict.approved,
          },
        });
      }

      // Synthetic word-by-word streaming of the validated reply.
      const delay = isMockMode() ? 18 : 12;
      writer.write({ type: "text-start", id: "reply" });
      for (const chunk of result.prospectText.split(/(?<= )/)) {
        writer.write({ type: "text-delta", id: "reply", delta: chunk });
        await sleep(delay);
      }
      writer.write({ type: "text-end", id: "reply" });

      writer.write({
        type: "data-call-status",
        data: { status: result.callStatus, outcome: result.outcome },
      });
      writer.write({ type: "finish" });
    },
    onError: (error) =>
      error instanceof Error ? error.message : "The call hit a snag.",
  });

  return createUIMessageStreamResponse({ stream });
}
