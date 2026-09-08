"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { reviews, scorecards } from "@/db/schema";
import { requireUser } from "@/auth/session";
import { CHANNELS } from "@/engine/types";
import { ArtifactParseError, parseArtifact } from "@/review/parse";
import { runReviewGrading, scheduleReviewGrading } from "@/review/queue";
import { newId } from "@/lib/ids";
import { channelLabel } from "@/lib/labels";

export interface SaveResult {
  error?: string;
}

const reviewPayloadSchema = z.object({
  channel: z.enum(CHANNELS),
  stage: z.enum(["cold", "active"]),
  title: z.string().trim().max(120),
  scorecardId: z.string().min(1, "Pick a scorecard to grade against."),
  rawText: z
    .string()
    .trim()
    .min(1, "Paste the conversation to review.")
    .max(100_000, "That's too long for one review — trim it down."),
});

export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;

/** Any signed-in user can submit a real artifact for review. */
export async function createReviewAction(
  payload: ReviewPayload,
): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = reviewPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const scorecard = db
    .select({ id: scorecards.id })
    .from(scorecards)
    .where(eq(scorecards.id, data.scorecardId))
    .get();
  if (!scorecard) return { error: "Scorecard not found." };

  let turns;
  try {
    turns = parseArtifact(data.rawText).turns;
  } catch (error) {
    if (error instanceof ArtifactParseError) return { error: error.message };
    throw error;
  }

  const id = newId();
  db.insert(reviews)
    .values({
      id,
      userId: user.id,
      channel: data.channel,
      stage: data.stage,
      title:
        data.title.length > 0
          ? data.title
          : `${channelLabel(data.channel)} review`,
      rawText: data.rawText,
      turns,
      scorecardId: data.scorecardId,
      status: "pending",
      createdAt: Date.now(),
    })
    .run();
  scheduleReviewGrading(id);
  redirect(`/review/${id}`);
}

/** Re-runs grading after a failure. */
export async function retryReviewAction(reviewId: string): Promise<void> {
  const user = await requireUser();
  const review = db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .get();
  if (!review || (user.role !== "trainer" && review.userId !== user.id)) {
    throw new Error("Review not found.");
  }
  db.update(reviews)
    .set({ status: "pending", error: null, gradingStartedAt: null })
    .where(eq(reviews.id, reviewId))
    .run();
  void runReviewGrading(reviewId);
  redirect(`/review/${reviewId}`);
}
