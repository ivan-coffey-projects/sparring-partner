"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, drillAssignments, reports } from "@/db/schema";
import { requireUser } from "@/auth/session";
import { finalizeCall, startCall } from "@/sim/calls";
import { runGrading } from "@/grading/queue";

/** Rep starts a call for an assigned drill. */
export async function startCallAction(drillId: string): Promise<void> {
  const user = await requireUser("rep");
  const assignment = db
    .select()
    .from(drillAssignments)
    .where(
      and(
        eq(drillAssignments.drillId, drillId),
        eq(drillAssignments.repId, user.id),
      ),
    )
    .get();
  if (!assignment) throw new Error("This drill is not assigned to you.");
  const callId = startCall(drillId, user.id);
  redirect(`/calls/${callId}`);
}

/** Rep hangs up voluntarily. */
export async function endCallAction(callId: string): Promise<void> {
  const user = await requireUser("rep");
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!call || call.repId !== user.id) throw new Error("Call not found.");
  if (call.status === "live") {
    finalizeCall(callId, "rep_ended");
  }
  redirect(`/calls/${callId}/debrief`);
}

/** Re-runs grading after a failure or an orphaned run. */
export async function retryGradingAction(callId: string): Promise<void> {
  const user = await requireUser();
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!call || (user.role !== "trainer" && call.repId !== user.id)) {
    throw new Error("Call not found.");
  }
  db.update(reports)
    .set({ status: "pending", error: null, gradingStartedAt: null })
    .where(eq(reports.callId, callId))
    .run();
  void runGrading(callId);
  redirect(`/calls/${callId}/debrief`);
}
