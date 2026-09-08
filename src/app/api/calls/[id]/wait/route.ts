import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls } from "@/db/schema";
import { getCurrentUser } from "@/auth/session";
import { runWaitTurn } from "@/sim/async-turn";

/** The rep lets simulated time pass on an async thread. */
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

  const body = (await request.json()) as { minutes?: number };
  const minutes = Number(body.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return Response.json({ error: "Invalid wait" }, { status: 400 });
  }

  try {
    return Response.json(runWaitTurn(callId, Math.round(minutes)));
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
