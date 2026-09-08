import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls } from "@/db/schema";
import { getCurrentUser } from "@/auth/session";
import { runAsyncMessageTurn } from "@/sim/async-turn";

export const maxDuration = 120;

/**
 * One rep message on an async thread. No streaming — messages arrive whole,
 * like the real channel. The engine decides reply-or-silence before the
 * prospect model is ever invoked.
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
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }
  if (call.status !== "live") {
    return Response.json({ error: "This thread has ended" }, { status: 409 });
  }

  const body = (await request.json()) as { text?: string; subject?: string };
  const text = body.text?.trim() ?? "";
  const subject = body.subject?.trim() || undefined;
  if (!text) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }

  try {
    const result = await runAsyncMessageTurn(callId, text, subject);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The thread hit a snag.",
      },
      { status: 500 },
    );
  }
}
