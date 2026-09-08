import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { newId } from "@/lib/ids";
import { gradeCall } from "@/grading/grade";

/**
 * In-process grading queue. `onCallEnded` creates the pending report row
 * synchronously (so the debrief page always has something to poll) and
 * schedules the actual grading run without blocking the caller.
 */
export function onCallEnded(callId: string): void {
  const existing = db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.callId, callId))
    .get();
  if (!existing) {
    db.insert(reports)
      .values({
        id: newId(),
        callId,
        status: "pending",
        createdAt: Date.now(),
      })
      .run();
  }
  scheduleGrading(callId);
}

function scheduleGrading(callId: string): void {
  setTimeout(() => {
    void runGrading(callId);
  }, 0);
}

/** Re-runs grading for a call (used by the retry action and the scheduler). */
export async function runGrading(callId: string): Promise<void> {
  try {
    await gradeCall(callId);
  } catch (error) {
    db.update(reports)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        gradingStartedAt: null,
      })
      .where(eq(reports.callId, callId))
      .run();
  }
}
